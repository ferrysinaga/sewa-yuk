-- BE-03: idempotensi RPC dan kontrak error pemesanan.
--
-- Tujuan:
--   1. Pemanggilan ulang RPC yang sama tidak menggandakan booking atau
--      mengubah data dua kali.
--   2. Setiap kegagalan punya kode/hint yang stabil sehingga frontend tidak
--      perlu membaca pesan mentah PostgreSQL.
--   3. Fungsi SECURITY DEFINER memakai search_path yang aman.
--
-- Kontrak error lengkap ada di supabase/ERROR_CONTRACT.md. Hint yang dipakai:
--   SWY_AUTH_REQUIRED, SWY_INVALID_PAYMENT_METHOD, SWY_BOOTH_NOT_FOUND,
--   SWY_BOOTH_UNAVAILABLE, SWY_EVENT_NOT_PUBLISHED, SWY_BOOKING_NOT_FOUND,
--   SWY_NOT_OWNER, SWY_FORBIDDEN, SWY_ALREADY_PAID, SWY_BOOKING_EXPIRED,
--   SWY_BOOKING_CANCELLED, SWY_INVALID_STATE.
--
-- Migrasi idempoten agar aman dijalankan ulang.

do $$
begin
  if to_regclass('public.bookings') is null then
    raise exception 'Tabel public.bookings belum ada. Jalankan migrasi 20261103000500_bookings.sql terlebih dahulu.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bookings'
      and column_name = 'cancelled_reason'
  ) then
    raise exception 'Kolom bookings.cancelled_reason belum ada. Jalankan migrasi 20261105000000_booking_expiry.sql terlebih dahulu.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- create_booking
--
-- Idempotensi:
--   - Bila pengguna yang sama sudah punya booking pending/awaiting_confirmation
--     pada booth yang sama, kembalikan booking itu dan selaraskan status booth.
--   - Booking confirmed pada booth yang sama ditolak dengan SWY_ALREADY_PAID.
--   - Booking pengguna lain yang masih aktif ditolak dengan
--     SWY_BOOTH_UNAVAILABLE.
-- ---------------------------------------------------------------------------
create or replace function public.create_booking(
  p_booth_id uuid,
  p_payment_method text default 'va'
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text := coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '');
  v_booth public.booths;
  v_booking public.bookings;
  v_existing public.bookings;
  v_tenant_name text;
  v_tenant_email text;
  v_constraint text;
begin
  if v_user_id is null then
    raise exception 'Silakan masuk terlebih dahulu untuk memesan booth.'
      using errcode = '42501', hint = 'SWY_AUTH_REQUIRED';
  end if;

  if p_payment_method not in ('va', 'transfer', 'qris') then
    raise exception 'Metode pembayaran tidak valid.'
      using errcode = '22023', hint = 'SWY_INVALID_PAYMENT_METHOD';
  end if;

  -- Kunci booth lebih dulu agar pemeriksaan status dan pembuatan booking
  -- berjalan serial untuk booth yang sama.
  select *
    into v_booth
    from public.booths
   where id = p_booth_id
   for update;

  if not found then
    raise exception 'Booth tidak ditemukan.'
      using errcode = 'P0002', hint = 'SWY_BOOTH_NOT_FOUND';
  end if;

  -- Retry dari pengguna yang sama: kembalikan booking aktif yang sudah ada.
  select *
    into v_existing
    from public.bookings
   where booth_id = p_booth_id
     and user_id = v_user_id
     and status in ('pending', 'awaiting_confirmation', 'confirmed')
   order by created_at desc, id desc
   limit 1;

  if found then
    if v_existing.status = 'confirmed' then
      raise exception 'Booth ini sudah Anda pesan dan pembayarannya sudah dikonfirmasi.'
        using errcode = 'P0001', hint = 'SWY_ALREADY_PAID';
    end if;

    -- Booking pending yang sudah lewat batas bukan target retry yang valid.
    -- Sweep release_expired_bookings akan membatalkannya dan melepas booth.
    if v_existing.status = 'pending'
       and v_existing.expires_at is not null
       and v_existing.expires_at <= now()
    then
      raise exception 'Pemesanan sebelumnya sudah kedaluwarsa. Muat ulang halaman lalu pesan kembali.'
        using errcode = 'P0001', hint = 'SWY_BOOKING_EXPIRED';
    end if;

    -- Pulihkan invariant bila status booth sempat berubah manual.
    update public.booths
       set status = 'Reserved',
           updated_at = now()
     where id = p_booth_id
       and status <> 'Reserved';

    return v_existing;
  end if;

  if v_booth.status <> 'Available' then
    raise exception 'Booth sudah tidak tersedia. Silakan pilih booth lain.'
      using errcode = 'P0001', hint = 'SWY_BOOTH_UNAVAILABLE';
  end if;

  -- Booth bisa terlihat Available karena perubahan manual, padahal masih ada
  -- booking aktif milik pengguna lain. Tolak sebelum insert.
  if exists (
    select 1
      from public.bookings
     where booth_id = p_booth_id
       and status in ('pending', 'awaiting_confirmation', 'confirmed')
  ) then
    raise exception 'Booth sudah tidak tersedia. Silakan pilih booth lain.'
      using errcode = 'P0001', hint = 'SWY_BOOTH_UNAVAILABLE';
  end if;

  -- Penyewa hanya boleh memesan event yang sudah dipublikasikan.
  -- Organizer tetap boleh memesan untuk keperluan pratinjau.
  if v_role <> 'organizer'
     and not exists (
       select 1
         from public.blueprints
        where id = v_booth.blueprint_id
          and status = 'published'
     )
  then
    raise exception 'Event ini belum dipublikasikan.'
      using errcode = 'P0001', hint = 'SWY_EVENT_NOT_PUBLISHED';
  end if;

  update public.booths
     set status = 'Reserved',
         updated_at = now()
   where id = p_booth_id;

  select coalesce(raw_user_meta_data ->> 'full_name', email), email
    into v_tenant_name, v_tenant_email
    from auth.users
   where id = v_user_id;

  insert into public.bookings (
    booth_id,
    blueprint_id,
    user_id,
    tenant_name,
    tenant_email,
    booth_category,
    price,
    status,
    payment_method,
    expires_at
  )
  values (
    v_booth.id,
    v_booth.blueprint_id,
    v_user_id,
    v_tenant_name,
    v_tenant_email,
    v_booth.category,
    v_booth.price,
    'pending',
    p_payment_method,
    now() + interval '24 hours'
  )
  returning * into v_booking;

  return v_booking;
exception
  when unique_violation then
    -- Jaring pengaman bila unique partial index BE-02 sudah terpasang.
    get stacked diagnostics v_constraint = constraint_name;

    if v_constraint = 'bookings_one_active_per_booth_idx' then
      raise exception 'Booth sudah tidak tersedia. Silakan pilih booth lain.'
        using errcode = 'P0001', hint = 'SWY_BOOTH_UNAVAILABLE';
    end if;

    raise;
end;
$$;

-- ---------------------------------------------------------------------------
-- mark_booking_paid
--
-- Idempoten untuk status awaiting_confirmation. Status confirmed ditolak
-- dengan SWY_ALREADY_PAID agar UI tidak menampilkan "menunggu verifikasi"
-- untuk booking yang sudah selesai.
-- ---------------------------------------------------------------------------
create or replace function public.mark_booking_paid(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking public.bookings;
begin
  if v_user_id is null then
    raise exception 'Silakan masuk terlebih dahulu.'
      using errcode = '42501', hint = 'SWY_AUTH_REQUIRED';
  end if;

  select *
    into v_booking
    from public.bookings
   where id = p_booking_id
   for update;

  if not found then
    raise exception 'Pemesanan tidak ditemukan.'
      using errcode = 'P0002', hint = 'SWY_BOOKING_NOT_FOUND';
  end if;

  if v_booking.user_id <> v_user_id then
    raise exception 'Anda tidak berhak mengubah pemesanan ini.'
      using errcode = '42501', hint = 'SWY_NOT_OWNER';
  end if;

  if v_booking.status = 'awaiting_confirmation' then
    return v_booking;
  end if;

  if v_booking.status = 'confirmed' then
    raise exception 'Pemesanan ini sudah dibayar dan dikonfirmasi.'
      using errcode = 'P0001', hint = 'SWY_ALREADY_PAID';
  end if;

  if v_booking.status = 'cancelled' then
    if v_booking.cancelled_reason = 'expired' then
      raise exception 'Pemesanan sudah kedaluwarsa. Booth telah dilepas untuk penyewa lain.'
        using errcode = 'P0001', hint = 'SWY_BOOKING_EXPIRED';
    end if;

    raise exception 'Pemesanan ini sudah dibatalkan.'
      using errcode = 'P0001', hint = 'SWY_BOOKING_CANCELLED';
  end if;

  if v_booking.status <> 'pending' then
    raise exception 'Status pemesanan tidak memungkinkan tindakan ini.'
      using errcode = 'P0001', hint = 'SWY_INVALID_STATE';
  end if;

  if v_booking.expires_at is not null and v_booking.expires_at <= now() then
    raise exception 'Pemesanan sudah kedaluwarsa. Booth telah dilepas untuk penyewa lain.'
      using errcode = 'P0001', hint = 'SWY_BOOKING_EXPIRED';
  end if;

  update public.bookings
     set status = 'awaiting_confirmation',
         updated_at = now()
   where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

-- ---------------------------------------------------------------------------
-- cancel_booking
--
-- Idempoten untuk booking yang sudah cancelled. Booking confirmed tetap
-- ditolak karena pembatalan setelah verifikasi bukan alur yang didukung.
-- ---------------------------------------------------------------------------
create or replace function public.cancel_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text := coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '');
  v_booking public.bookings;
  v_reason text;
begin
  if v_user_id is null then
    raise exception 'Silakan masuk terlebih dahulu.'
      using errcode = '42501', hint = 'SWY_AUTH_REQUIRED';
  end if;

  select *
    into v_booking
    from public.bookings
   where id = p_booking_id
   for update;

  if not found then
    raise exception 'Pemesanan tidak ditemukan.'
      using errcode = 'P0002', hint = 'SWY_BOOKING_NOT_FOUND';
  end if;

  if v_booking.user_id <> v_user_id and v_role <> 'organizer' then
    raise exception 'Anda tidak berhak membatalkan pemesanan ini.'
      using errcode = '42501', hint = 'SWY_NOT_OWNER';
  end if;

  if v_booking.status = 'cancelled' then
    return v_booking;
  end if;

  if v_booking.status = 'confirmed' then
    raise exception 'Pemesanan yang sudah dikonfirmasi tidak dapat dibatalkan.'
      using errcode = 'P0001', hint = 'SWY_INVALID_STATE';
  end if;

  if v_booking.status not in ('pending', 'awaiting_confirmation') then
    raise exception 'Status pemesanan tidak memungkinkan pembatalan.'
      using errcode = 'P0001', hint = 'SWY_INVALID_STATE';
  end if;

  v_reason := case
    when v_booking.status = 'pending'
      and v_booking.expires_at is not null
      and v_booking.expires_at <= now()
      then 'expired'
    else 'manual'
  end;

  update public.bookings
     set status = 'cancelled',
         cancelled_at = now(),
         cancelled_reason = v_reason,
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

-- ---------------------------------------------------------------------------
-- confirm_booking
--
-- Idempoten untuk booking yang sudah confirmed. Booking pending yang lewat
-- batas tetap ditolak.
-- ---------------------------------------------------------------------------
create or replace function public.confirm_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text := coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '');
  v_booking public.bookings;
begin
  if v_user_id is null then
    raise exception 'Silakan masuk terlebih dahulu.'
      using errcode = '42501', hint = 'SWY_AUTH_REQUIRED';
  end if;

  if v_role <> 'organizer' then
    raise exception 'Hanya organizer yang dapat mengonfirmasi pembayaran.'
      using errcode = '42501', hint = 'SWY_FORBIDDEN';
  end if;

  select *
    into v_booking
    from public.bookings
   where id = p_booking_id
   for update;

  if not found then
    raise exception 'Pemesanan tidak ditemukan.'
      using errcode = 'P0002', hint = 'SWY_BOOKING_NOT_FOUND';
  end if;

  if v_booking.status = 'confirmed' then
    return v_booking;
  end if;

  if v_booking.status = 'cancelled' then
    if v_booking.cancelled_reason = 'expired' then
      raise exception 'Pemesanan sudah kedaluwarsa dan tidak dapat dikonfirmasi.'
        using errcode = 'P0001', hint = 'SWY_BOOKING_EXPIRED';
    end if;

    raise exception 'Pemesanan ini sudah dibatalkan.'
      using errcode = 'P0001', hint = 'SWY_BOOKING_CANCELLED';
  end if;

  if v_booking.status not in ('pending', 'awaiting_confirmation') then
    raise exception 'Status pemesanan tidak memungkinkan konfirmasi.'
      using errcode = 'P0001', hint = 'SWY_INVALID_STATE';
  end if;

  if v_booking.status = 'pending'
     and v_booking.expires_at is not null
     and v_booking.expires_at <= now()
  then
    raise exception 'Pemesanan sudah kedaluwarsa dan tidak dapat dikonfirmasi.'
      using errcode = 'P0001', hint = 'SWY_BOOKING_EXPIRED';
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

-- ---------------------------------------------------------------------------
-- release_expired_bookings
--
-- Sudah idempoten; migrasi ini hanya menegaskan search_path yang aman dan
-- hak eksekusi. Rekonsiliasi booth yatim ditambahkan pada migrasi BE-02.
-- ---------------------------------------------------------------------------
create or replace function public.release_expired_bookings()
returns integer
language plpgsql
security definer
set search_path = ''
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

-- Fungsi SECURITY DEFINER tidak boleh dieksekusi oleh PUBLIC secara default.
revoke all on function public.create_booking(uuid, text) from public;
revoke all on function public.mark_booking_paid(uuid) from public;
revoke all on function public.cancel_booking(uuid) from public;
revoke all on function public.confirm_booking(uuid) from public;
revoke all on function public.release_expired_bookings() from public;

grant execute on function public.create_booking(uuid, text) to authenticated;
grant execute on function public.mark_booking_paid(uuid) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;
grant execute on function public.confirm_booking(uuid) to authenticated;
grant execute on function public.release_expired_bookings() to anon, authenticated;
