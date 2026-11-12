-- BE-07: remediasi eskalasi role lewat user_metadata (F1).
--
-- Sebelum migrasi ini, seluruh policy dan RPC membaca
-- `auth.jwt() -> 'user_metadata' ->> 'role'`. Pengguna dapat mengubah
-- user_metadata sendiri lewat Supabase Auth, sehingga tenant dapat menaikkan
-- diri menjadi organizer.
--
-- Migrasi ini:
--   1. menambahkan helper public.current_user_role() yang hanya membaca
--      app_metadata.role (tidak dapat diubah pengguna);
--   2. mengganti seluruh policy dan RPC agar memakai helper tersebut;
--   3. TIDAK melakukan backfill otomatis dari user_metadata, karena nilai itu
--      tidak dapat dipercaya. Backfill organizer dilakukan eksplisit lewat
--      scripts/backfill-roles.mjs dengan allowlist email/UUID.
--
-- Urutan rilis: migrasi + backfill organizer -> deploy frontend -> verifikasi
-- RLS-14. Lihat supabase/AUTH_ROLES.md.
--
-- Idempoten: create or replace, drop policy if exists, dan create policy ulang.

do $$
begin
  if to_regprocedure('public.create_booking(uuid,text)') is null then
    raise exception 'RPC create_booking belum ada. Jalankan migrasi 20261103000500_bookings.sql terlebih dahulu.';
  end if;

  if to_regclass('public.bookings') is null or to_regclass('public.booths') is null then
    raise exception 'Tabel bookings/booths belum ada. Jalankan migrasi dasar terlebih dahulu.';
  end if;

  if to_regclass('storage.objects') is null then
    raise exception 'Schema Storage belum siap. Jalankan migrasi 20261103000400_blueprint_images.sql terlebih dahulu.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Helper otorisasi.
--
-- app_metadata hanya dapat diubah lewat service role/Admin API, bukan oleh
-- pengguna. Akun tanpa app_metadata.role diperlakukan sebagai tenant agar
-- akun lama dan akun baru tetap aman tanpa backfill tenant.
-- ---------------------------------------------------------------------------
create or replace function public.current_user_role()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'role', ''),
    'tenant'
  )
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to anon, authenticated;

comment on function public.current_user_role() is
  'BE-07: role otorisasi dari app_metadata.role; fallback tenant. Jangan memakai user_metadata.';

-- ---------------------------------------------------------------------------
-- Policy tabel public.
-- ---------------------------------------------------------------------------
drop policy if exists "Organizers can manage booths" on public.booths;
create policy "Organizers can manage booths"
  on public.booths
  for all
  to authenticated
  using (public.current_user_role() = 'organizer')
  with check (public.current_user_role() = 'organizer');

drop policy if exists "Organizers can manage blueprints" on public.blueprints;
create policy "Organizers can manage blueprints"
  on public.blueprints
  for all
  to authenticated
  using (public.current_user_role() = 'organizer')
  with check (public.current_user_role() = 'organizer');

drop policy if exists "Published blueprints are publicly readable" on public.blueprints;
create policy "Published blueprints are publicly readable"
  on public.blueprints
  for select
  using (
    status = 'published'
    or public.current_user_role() = 'organizer'
  );

drop policy if exists "Booths are readable for published blueprints" on public.booths;
create policy "Booths are readable for published blueprints"
  on public.booths
  for select
  using (
    exists (
      select 1
        from public.blueprints
       where blueprints.id = booths.blueprint_id
         and blueprints.status = 'published'
    )
    or public.current_user_role() = 'organizer'
  );

drop policy if exists "Organizers can manage bookings" on public.bookings;
create policy "Organizers can manage bookings"
  on public.bookings
  for all
  to authenticated
  using (public.current_user_role() = 'organizer')
  with check (public.current_user_role() = 'organizer');

-- ---------------------------------------------------------------------------
-- Policy Storage.
-- ---------------------------------------------------------------------------
drop policy if exists "Organizers can upload blueprint images" on storage.objects;
create policy "Organizers can upload blueprint images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'blueprint-assets'
    and public.current_user_role() = 'organizer'
  );

drop policy if exists "Organizers can update blueprint images" on storage.objects;
create policy "Organizers can update blueprint images"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'blueprint-assets'
    and public.current_user_role() = 'organizer'
  )
  with check (
    bucket_id = 'blueprint-assets'
    and public.current_user_role() = 'organizer'
  );

drop policy if exists "Organizers can delete blueprint images" on storage.objects;
create policy "Organizers can delete blueprint images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'blueprint-assets'
    and public.current_user_role() = 'organizer'
  );

-- ---------------------------------------------------------------------------
-- create_booking: body sama dengan BE-03, hanya sumber role yang berubah.
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
  v_role text := public.current_user_role();
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
-- mark_booking_paid tidak memakai role; body tetap dari BE-03.
-- Tidak perlu di-replace di sini.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- cancel_booking: body sama dengan BE-03, hanya sumber role yang berubah.
-- ---------------------------------------------------------------------------
create or replace function public.cancel_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text := public.current_user_role();
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
-- confirm_booking: body sama dengan BE-03, hanya sumber role yang berubah.
-- ---------------------------------------------------------------------------
create or replace function public.confirm_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text := public.current_user_role();
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

-- Pertahankan hak eksekusi minimum dari BE-03.
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

do $$
begin
  raise notice
    'BE-07 aktif: otorisasi memakai app_metadata.role. Jalankan scripts/backfill-roles.mjs untuk organizer lama sebelum deploy frontend.';
end $$;
