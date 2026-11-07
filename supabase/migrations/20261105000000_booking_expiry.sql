-- Booking expiry: lepas booth yang tertahan oleh pemesanan pending.
--
-- Sebelum migrasi ini, expires_at hanya ditampilkan di UI. Booking pending
-- yang lewat batas pembayaran tidak pernah dibatalkan sehingga booth tetap
-- Reserved selamanya. Migrasi ini menambahkan:
--   1. kolom cancelled_reason agar UI dapat membedakan kedaluwarsa dari
--      pembatalan manual;
--   2. RPC release_expired_bookings() yang membatalkan booking pending
--      kedaluwarsa dan mengembalikan booth Reserved menjadi Available;
--   3. jadwal pg_cron setiap 2 menit bila ekstensi tersedia.
--
-- Pemanggilan dari client (saat halaman dibuka / tombol perbarui status)
-- menjadi fallback bila pg_cron tidak aktif.
--
-- Migrasi idempoten agar aman dijalankan ulang.

do $$
begin
  if to_regclass('public.bookings') is null then
    raise exception 'Tabel public.bookings belum ada. Jalankan migrasi 20261103000500_bookings.sql terlebih dahulu.';
  end if;
end $$;

-- Alasan pembatalan: 'expired' (otomatis) atau 'manual' (tenant/organizer).
alter table public.bookings
  add column if not exists cancelled_reason text;

alter table public.bookings
  drop constraint if exists bookings_cancelled_reason_check;

alter table public.bookings
  add constraint bookings_cancelled_reason_check
  check (cancelled_reason is null or cancelled_reason in ('manual', 'expired'));

-- Mempercepat pencarian booking pending yang sudah lewat batas.
create index if not exists bookings_pending_expiry_idx
  on public.bookings (expires_at)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- RPC: batalkan booking pending yang kedaluwarsa dan lepas booth-nya.
--
-- FOR UPDATE SKIP LOCKED mencegah dua pemanggilan paralel memproses booking
-- yang sama. SECURITY DEFINER dipakai agar perubahan booking dan booth terjadi
-- dalam satu transaksi, termasuk saat dipanggil oleh penyewa/anonymous.
-- ---------------------------------------------------------------------------
create or replace function public.release_expired_bookings()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_released integer := 0;
begin
  for v_booking in
    select *
      from public.bookings
     where status = 'pending'
       and expires_at is not null
       and expires_at <= now()
     order by expires_at
       for update skip locked
  loop
    update public.bookings
       set status = 'cancelled',
           cancelled_at = now(),
           cancelled_reason = 'expired',
           updated_at = now()
     where id = v_booking.id;

    if v_booking.booth_id is not null then
      update public.booths
         set status = 'Available',
             updated_at = now()
       where id = v_booking.booth_id
         and status = 'Reserved';
    end if;

    v_released := v_released + 1;
  end loop;

  return v_released;
end;
$$;

revoke all on function public.release_expired_bookings() from public;
grant execute on function public.release_expired_bookings() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC lama diselaraskan dengan aturan kedaluwarsa.
-- ---------------------------------------------------------------------------

create or replace function public.mark_booking_paid(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking public.bookings;
begin
  if v_user_id is null then
    raise exception 'Silakan masuk terlebih dahulu.'
      using errcode = '42501';
  end if;

  select *
    into v_booking
    from public.bookings
   where id = p_booking_id
   for update;

  if not found then
    raise exception 'Pemesanan tidak ditemukan.'
      using errcode = 'P0002';
  end if;

  if v_booking.user_id <> v_user_id then
    raise exception 'Anda tidak berhak mengubah pemesanan ini.'
      using errcode = '42501';
  end if;

  if v_booking.status <> 'pending' then
    raise exception 'Pemesanan ini tidak sedang menunggu pembayaran.'
      using errcode = 'P0001';
  end if;

  -- Tolak pembayaran yang datang setelah batas. Pembersihan booth dilakukan
  -- oleh release_expired_bookings agar perubahan tidak ikut ter-rollback.
  if v_booking.expires_at is not null and v_booking.expires_at <= now() then
    raise exception 'Pemesanan sudah kedaluwarsa. Booth telah dilepas untuk penyewa lain.'
      using errcode = 'P0001';
  end if;

  update public.bookings
     set status = 'awaiting_confirmation',
         updated_at = now()
   where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

create or replace function public.cancel_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text := coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '');
  v_booking public.bookings;
begin
  if v_user_id is null then
    raise exception 'Silakan masuk terlebih dahulu.'
      using errcode = '42501';
  end if;

  select *
    into v_booking
    from public.bookings
   where id = p_booking_id
   for update;

  if not found then
    raise exception 'Pemesanan tidak ditemukan.'
      using errcode = 'P0002';
  end if;

  if v_booking.user_id <> v_user_id and v_role <> 'organizer' then
    raise exception 'Anda tidak berhak membatalkan pemesanan ini.'
      using errcode = '42501';
  end if;

  if v_booking.status not in ('pending', 'awaiting_confirmation') then
    raise exception 'Pemesanan ini tidak dapat dibatalkan.'
      using errcode = 'P0001';
  end if;

  update public.bookings
     set status = 'cancelled',
         cancelled_at = now(),
         cancelled_reason = 'manual',
         updated_at = now()
   where id = p_booking_id
  returning * into v_booking;

  if v_booking.booth_id is not null then
    update public.booths
       set status = 'Available',
           updated_at = now()
     where id = v_booking.booth_id
       and status = 'Reserved';
  end if;

  return v_booking;
end;
$$;

create or replace function public.confirm_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text := coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '');
  v_booking public.bookings;
begin
  if v_user_id is null then
    raise exception 'Silakan masuk terlebih dahulu.'
      using errcode = '42501';
  end if;

  if v_role <> 'organizer' then
    raise exception 'Hanya organizer yang dapat mengonfirmasi pembayaran.'
      using errcode = '42501';
  end if;

  select *
    into v_booking
    from public.bookings
   where id = p_booking_id
   for update;

  if not found then
    raise exception 'Pemesanan tidak ditemukan.'
      using errcode = 'P0002';
  end if;

  if v_booking.status not in ('pending', 'awaiting_confirmation') then
    raise exception 'Pemesanan ini tidak dapat dikonfirmasi.'
      using errcode = 'P0001';
  end if;

  -- Booking pending yang lewat batas tidak boleh dikonfirmasi. Booking yang
  -- sudah awaiting_confirmation tetap boleh diverifikasi organizer.
  if v_booking.status = 'pending'
     and v_booking.expires_at is not null
     and v_booking.expires_at <= now()
  then
    raise exception 'Pemesanan sudah kedaluwarsa dan tidak dapat dikonfirmasi.'
      using errcode = 'P0001';
  end if;

  update public.bookings
     set status = 'confirmed',
         paid_at = now(),
         updated_at = now()
   where id = p_booking_id
  returning * into v_booking;

  if v_booking.booth_id is not null then
    update public.booths
       set status = 'Booked',
           updated_at = now()
     where id = v_booking.booth_id;
  end if;

  return v_booking;
end;
$$;

grant execute on function public.mark_booking_paid(uuid) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;
grant execute on function public.confirm_booking(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Pastikan perubahan booth/booking tetap disiarkan Supabase Realtime. Tenant
-- lain perlu langsung melihat booth kembali Available setelah sweep berjalan.
-- ---------------------------------------------------------------------------
alter table public.booths replica identity full;
alter table public.bookings replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
        from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'booths'
    ) then
      alter publication supabase_realtime add table public.booths;
    end if;

    if not exists (
      select 1
        from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'bookings'
    ) then
      alter publication supabase_realtime add table public.bookings;
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Jadwalkan pembersihan otomatis. Bila pg_cron tidak tersedia, lewati dengan
-- aman; halaman bookings/event tetap memanggil RPC saat dibuka.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
    exception
      when others then
        raise notice 'pg_cron tidak dapat diaktifkan: %', sqlerrm;
    end;
  end if;

  if to_regnamespace('cron') is not null then
    begin
      perform cron.unschedule('release-expired-bookings');
    exception
      when others then
        null;
    end;

    begin
      perform cron.schedule(
        'release-expired-bookings',
        '*/2 * * * *',
        $cron$select public.release_expired_bookings();$cron$
      );
    exception
      when others then
        raise notice 'Gagal menjadwalkan pg_cron release-expired-bookings: %', sqlerrm;
    end;
  else
    raise notice 'pg_cron tidak tersedia; pembersihan booking kedaluwarsa dijalankan dari aplikasi.';
  end if;
end $$;
