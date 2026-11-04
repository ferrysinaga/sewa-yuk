-- Phase 3: siklus pemesanan booth.
--
-- Alur: booth Available -> tenant membuat booking (booth Reserved) ->
-- tenant menandai sudah membayar -> organizer memverifikasi (booth Booked)
-- atau membatalkan (booth Available kembali).
--
-- Migrasi ini idempoten agar aman dijalankan ulang ketika eksekusi sebelumnya
-- berhenti di tengah jalan.

-- Pastikan tabel dasar sudah ada agar pesan errornya jelas.
do $$
begin
  if to_regclass('public.booths') is null then
    raise exception 'Tabel public.booths belum ada. Jalankan migrasi 20261103000000_create_booths.sql terlebih dahulu.';
  end if;

  if to_regclass('public.blueprints') is null then
    raise exception 'Tabel public.blueprints belum ada. Jalankan migrasi 20261103000100_create_blueprints.sql terlebih dahulu.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'blueprints'
      and column_name = 'status'
  ) then
    raise exception 'Kolom blueprints.status belum ada. Jalankan migrasi 20261103000300_blueprint_publishing.sql terlebih dahulu.';
  end if;
end $$;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_code text not null default (
    'SWY-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  ),
  -- booth_id dibuat nullable agar riwayat pemesanan tetap ada ketika booth
  -- dihapus dari denah oleh organizer.
  booth_id uuid references public.booths (id) on delete set null,
  blueprint_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  tenant_name text,
  tenant_email text,
  tenant_phone text,
  booth_category text not null,
  price integer not null default 0,
  status text not null default 'pending',
  payment_method text not null default 'va',
  reserved_at timestamptz not null default now(),
  expires_at timestamptz default (now() + interval '24 hours'),
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists bookings_booking_code_idx on public.bookings (booking_code);
create index if not exists bookings_user_id_idx on public.bookings (user_id);
create index if not exists bookings_booth_id_idx on public.bookings (booth_id);
create index if not exists bookings_blueprint_id_idx on public.bookings (blueprint_id);
create index if not exists bookings_status_idx on public.bookings (status);

-- Pastikan constraint selalu memakai definisi terbaru.
alter table public.bookings
  drop constraint if exists bookings_status_check;

alter table public.bookings
  add constraint bookings_status_check
  check (status in ('pending', 'awaiting_confirmation', 'confirmed', 'cancelled'));

alter table public.bookings
  drop constraint if exists bookings_payment_method_check;

alter table public.bookings
  add constraint bookings_payment_method_check
  check (payment_method in ('va', 'transfer', 'qris'));

alter table public.bookings enable row level security;

-- Penyewa hanya dapat membaca pemesanan miliknya sendiri.
drop policy if exists "Tenants can view own bookings" on public.bookings;
create policy "Tenants can view own bookings"
  on public.bookings
  for select
  to authenticated
  using (user_id = auth.uid());

-- Organizer dapat membaca dan mengelola seluruh pemesanan.
drop policy if exists "Organizers can manage bookings" on public.bookings;
create policy "Organizers can manage bookings"
  on public.bookings
  for all
  to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'organizer')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'organizer');

grant select on public.bookings to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: pembuatan dan perubahan status pemesanan.
--
-- Ditulis sebagai SECURITY DEFINER agar perubahan booth dan booking terjadi
-- dalam satu transaksi. Penyewa tidak dapat mengubah status booth secara
-- langsung, sehingga status booth selalu konsisten dengan data pemesanan.
-- ---------------------------------------------------------------------------

create or replace function public.create_booking(
  p_booth_id uuid,
  p_payment_method text default 'va'
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text := coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '');
  v_booth public.booths;
  v_booking public.bookings;
  v_tenant_name text;
  v_tenant_email text;
begin
  if v_user_id is null then
    raise exception 'Silakan masuk terlebih dahulu untuk memesan booth.'
      using errcode = '42501';
  end if;

  if p_payment_method not in ('va', 'transfer', 'qris') then
    raise exception 'Metode pembayaran tidak valid.'
      using errcode = '22023';
  end if;

  select *
    into v_booth
    from public.booths
   where id = p_booth_id
   for update;

  if not found then
    raise exception 'Booth tidak ditemukan.'
      using errcode = 'P0002';
  end if;

  if v_booth.status <> 'Available' then
    raise exception 'Booth sudah tidak tersedia. Silakan pilih booth lain.'
      using errcode = 'P0001';
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
      using errcode = 'P0001';
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
end;
$$;

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

grant execute on function public.create_booking(uuid, text) to authenticated;
grant execute on function public.mark_booking_paid(uuid) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;
grant execute on function public.confirm_booking(uuid) to authenticated;

-- Penyewa tidak lagi boleh mengubah status booth secara langsung. Reservasi
-- hanya melalui create_booking agar selalu ada data pemesanan yang menyertainya.
drop policy if exists "Tenants can reserve available booths" on public.booths;

-- Siarkan perubahan pemesanan agar halaman tenant dan organizer sinkron.
alter table public.bookings replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'bookings'
     )
  then
    alter publication supabase_realtime add table public.bookings;
  end if;
end $$;
