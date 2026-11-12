-- BE-01: uji matriks RLS dan otorisasi database.
--
-- HANYA UNTUK STAGING. Skrip ini membuat fixture uji, mengambil peran anon /
-- tenant A / tenant B / organizer, lalu rollback. Jangan jalankan di produksi.
--
-- Kebutuhan:
--   - psql yang terhubung ke database staging (connection string Supabase).
--   - Tiga akun yang sudah ada di auth.users: organizer, tenant A, tenant B.
--
-- Contoh:
--   psql "$SUPABASE_DB_URL" \
--     -v confirm_staging=yes \
--     -v organizer_id='<uuid-organizer>' \
--     -v tenant_a_id='<uuid-tenant-a>' \
--     -v tenant_b_id='<uuid-tenant-b>' \
--     -f supabase/tests/rls_matrix.sql
--
-- Catatan: release_expired_bookings() adalah sweep global. Pemanggilannya di
-- skrip ini juga menyentuh booking/booth staging lain, tetapi seluruh transaksi
-- di-rollback sehingga tidak ada perubahan permanen.

\set ON_ERROR_STOP on

\if :{?confirm_staging}
\else
  \echo 'Ditolak: jalankan hanya di staging dengan -v confirm_staging=yes.'
  \quit
\endif

select case when :'confirm_staging' = 'yes' then 'true' else 'false' end
       as rls_confirmed
\gset
\if :rls_confirmed
\else
  \echo 'Ditolak: nilai confirm_staging harus yes.'
  \quit
\endif

\if :{?organizer_id}
\else
  \echo 'Ditolak: parameter organizer_id belum diisi.'
  \quit
\endif

\if :{?tenant_a_id}
\else
  \echo 'Ditolak: parameter tenant_a_id belum diisi.'
  \quit
\endif

\if :{?tenant_b_id}
\else
  \echo 'Ditolak: parameter tenant_b_id belum diisi.'
  \quit
\endif

begin;

select set_config('rls_test.organizer_id', :'organizer_id', false) as _organizer,
       set_config('rls_test.tenant_a_id', :'tenant_a_id', false) as _tenant_a,
       set_config('rls_test.tenant_b_id', :'tenant_b_id', false) as _tenant_b
\gset

-- ---------------------------------------------------------------------------
-- 0. Prasyarat: akun uji ada.
-- ---------------------------------------------------------------------------
do $$
declare
  v_missing text;
begin
  select string_agg(v.label, ', ')
    into v_missing
    from (
      values
        ('organizer', current_setting('rls_test.organizer_id')::uuid),
        ('tenant_a', current_setting('rls_test.tenant_a_id')::uuid),
        ('tenant_b', current_setting('rls_test.tenant_b_id')::uuid)
    ) as v(label, id)
   where not exists (
     select 1 from auth.users u where u.id = v.id
   );

  if v_missing is not null then
    raise exception 'Akun uji tidak ditemukan di auth.users: %', v_missing;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Fixture uji. ID sengaja khusus agar tidak bentrok dengan data nyata.
-- ---------------------------------------------------------------------------
delete from public.bookings
 where id in (
   '00000000-0000-4000-8000-00000000c001',
   '00000000-0000-4000-8000-00000000c002',
   '00000000-0000-4000-8000-00000000c003'
 );

delete from public.booths
 where id in (
   '00000000-0000-4000-8000-00000000b001',
   '00000000-0000-4000-8000-00000000b002',
   '00000000-0000-4000-8000-00000000b003',
   '00000000-0000-4000-8000-00000000b004',
   '00000000-0000-4000-8000-00000000b006'
 );

delete from public.blueprints
 where id in ('rls-test-draft', 'rls-test-pub', 'rls-test-tenant-insert');

insert into public.blueprints (id, name, status)
values
  ('rls-test-draft', 'RLS Test Draft', 'draft'),
  ('rls-test-pub', 'RLS Test Published', 'published');

insert into public.booths
  (id, blueprint_id, category, width, height, price, status)
values
  ('00000000-0000-4000-8000-00000000b001', 'rls-test-pub',   'Tech', 100, 100, 100000, 'Available'),
  ('00000000-0000-4000-8000-00000000b002', 'rls-test-draft', 'Tech', 100, 100, 100000, 'Available'),
  ('00000000-0000-4000-8000-00000000b003', 'rls-test-pub',   'Tech', 100, 100, 100000, 'Reserved'),
  ('00000000-0000-4000-8000-00000000b004', 'rls-test-pub',   'Tech', 100, 100, 100000, 'Reserved'),
  ('00000000-0000-4000-8000-00000000b006', 'rls-test-pub',   'Tech', 100, 100, 100000, 'Reserved');

insert into public.bookings
  (id, booth_id, blueprint_id, user_id, booth_category, price, status,
   payment_method, expires_at)
values
  (
    '00000000-0000-4000-8000-00000000c001',
    '00000000-0000-4000-8000-00000000b003',
    'rls-test-pub',
    current_setting('rls_test.tenant_a_id')::uuid,
    'Tech', 100000, 'pending', 'va', now() + interval '1 day'
  ),
  (
    '00000000-0000-4000-8000-00000000c002',
    '00000000-0000-4000-8000-00000000b004',
    'rls-test-pub',
    current_setting('rls_test.tenant_b_id')::uuid,
    'Tech', 100000, 'pending', 'va', now() + interval '1 day'
  ),
  (
    '00000000-0000-4000-8000-00000000c003',
    '00000000-0000-4000-8000-00000000b006',
    'rls-test-pub',
    current_setting('rls_test.tenant_b_id')::uuid,
    'Tech', 100000, 'pending', 'va', now() - interval '1 minute'
  );

-- ---------------------------------------------------------------------------
-- 2. Katalog policy, grant, dan bucket.
-- ---------------------------------------------------------------------------
do $$
declare
  v_count integer;
begin
  -- Tabel booths: dua policy aktif, policy lama sudah hilang.
  select count(*) into v_count
    from pg_policies
   where schemaname = 'public'
     and tablename = 'booths'
     and policyname in (
       'Booths are readable for published blueprints',
       'Organizers can manage booths'
     );
  if v_count <> 2 then
    raise exception 'Katalog booths: expected 2 policy, got %', v_count;
  end if;

  if exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'booths'
       and policyname in (
         'Booths are publicly readable',
         'Tenants can reserve available booths'
       )
  ) then
    raise exception 'Katalog booths: policy lama masih ada';
  end if;

  -- Tabel blueprints: dua policy aktif, policy lama sudah hilang.
  select count(*) into v_count
    from pg_policies
   where schemaname = 'public'
     and tablename = 'blueprints'
     and policyname in (
       'Published blueprints are publicly readable',
       'Organizers can manage blueprints'
     );
  if v_count <> 2 then
    raise exception 'Katalog blueprints: expected 2 policy, got %', v_count;
  end if;

  if exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'blueprints'
       and policyname = 'Blueprints are publicly readable'
  ) then
    raise exception 'Katalog blueprints: policy lama masih ada';
  end if;

  -- Tabel bookings: dua policy aktif.
  select count(*) into v_count
    from pg_policies
   where schemaname = 'public'
     and tablename = 'bookings'
     and policyname in (
       'Tenants can view own bookings',
       'Organizers can manage bookings'
     );
  if v_count <> 2 then
    raise exception 'Katalog bookings: expected 2 policy, got %', v_count;
  end if;

  -- Storage: empat policy untuk bucket blueprint-assets.
  select count(*) into v_count
    from pg_policies
   where schemaname = 'storage'
     and tablename = 'objects'
     and policyname in (
       'Blueprint images are publicly readable',
       'Organizers can upload blueprint images',
       'Organizers can update blueprint images',
       'Organizers can delete blueprint images'
     );
  if v_count <> 4 then
    raise exception 'Katalog storage: expected 4 policy, got %', v_count;
  end if;

  -- Grant dan default privilege. Project Supabase standar memberi ALL kepada
  -- anon/authenticated; jangan menganggap grant tulis tidak ada. RLS yang
  -- menolak tenant/anon. Nilai di bawah dicatat sebagai temuan F5.
  if not has_table_privilege('anon', 'public.booths', 'SELECT') then
    raise exception 'Grant: anon harus bisa SELECT booths';
  end if;
  if not has_table_privilege('authenticated', 'public.bookings', 'SELECT') then
    raise exception 'Grant: authenticated harus bisa SELECT bookings';
  end if;

  raise notice 'F5: anon INSERT/UPDATE/DELETE bookings = %/%/%',
    has_table_privilege('anon', 'public.bookings', 'INSERT'),
    has_table_privilege('anon', 'public.bookings', 'UPDATE'),
    has_table_privilege('anon', 'public.bookings', 'DELETE');

  raise notice 'F5: authenticated INSERT/UPDATE/DELETE bookings = %/%/%',
    has_table_privilege('authenticated', 'public.bookings', 'INSERT'),
    has_table_privilege('authenticated', 'public.bookings', 'UPDATE'),
    has_table_privilege('authenticated', 'public.bookings', 'DELETE');

  raise notice 'F5: anon EXECUTE create_booking/mark/cancel/confirm = %/%/%/%',
    has_function_privilege('anon', 'public.create_booking(uuid,text)', 'EXECUTE'),
    has_function_privilege('anon', 'public.mark_booking_paid(uuid)', 'EXECUTE'),
    has_function_privilege('anon', 'public.cancel_booking(uuid)', 'EXECUTE'),
    has_function_privilege('anon', 'public.confirm_booking(uuid)', 'EXECUTE');

  if not has_function_privilege('anon', 'public.release_expired_bookings()', 'EXECUTE') then
    raise exception 'Grant: anon harus bisa EXECUTE release_expired_bookings';
  end if;
  if not has_function_privilege('authenticated', 'public.create_booking(uuid,text)', 'EXECUTE') then
    raise exception 'Grant: authenticated harus bisa EXECUTE create_booking';
  end if;

  -- Lima RPC pemesanan harus SECURITY DEFINER.
  select count(*) into v_count
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prosecdef
     and p.proname in (
       'create_booking',
       'mark_booking_paid',
       'cancel_booking',
       'confirm_booking',
       'release_expired_bookings'
     );
  if v_count <> 5 then
    raise exception 'RPC: expected 5 SECURITY DEFINER, got %', v_count;
  end if;

  -- Bucket publik dengan batas yang diharapkan.
  select count(*) into v_count
    from storage.buckets b
   where b.id = 'blueprint-assets'
     and b."public" = true
     and b.file_size_limit = 5242880;
  if v_count <> 1 then
    raise exception 'Storage: bucket blueprint-assets tidak sesuai';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Anon: hanya boleh membaca blueprint/booth published.
-- ---------------------------------------------------------------------------
set local role anon;
select set_config(
         'request.jwt.claims',
         jsonb_build_object('role', 'anon')::text,
         true
       ) as _claims,
       set_config('request.jwt.claim.sub', '', true) as _sub
\gset

do $$
declare
  v_count integer;
begin
  select count(*) into v_count
    from public.blueprints where id = 'rls-test-pub';
  if v_count <> 1 then
    raise exception 'RLS-02 anon: published blueprint expected 1, got %', v_count;
  end if;

  select count(*) into v_count
    from public.blueprints where id = 'rls-test-draft';
  if v_count <> 0 then
    raise exception 'RLS-02 anon: draft blueprint expected 0, got %', v_count;
  end if;

  select count(*) into v_count
    from public.booths where blueprint_id = 'rls-test-pub';
  if v_count <> 4 then
    raise exception 'Anon: published booths expected 4, got %', v_count;
  end if;

  select count(*) into v_count
    from public.booths where blueprint_id = 'rls-test-draft';
  if v_count <> 0 then
    raise exception 'Anon: draft booths expected 0, got %', v_count;
  end if;
end $$;

do $$
declare
  v_count integer;
begin
  begin
    select count(*) into v_count from public.bookings;

    if v_count <> 0 then
      raise exception 'RLS-06 anon: SELECT bookings expected 0 rows, got %', v_count;
    end if;
  exception
    when insufficient_privilege then null;
  end;
end $$;

do $$
declare
  v_rows integer := 0;
begin
  begin
    update public.bookings
       set status = 'confirmed'
     where id = '00000000-0000-4000-8000-00000000c001';
    get diagnostics v_rows = row_count;
  exception
    when insufficient_privilege then v_rows := 0;
  end;

  if v_rows <> 0 then
    raise exception 'RLS-06 anon: UPDATE booking seharusnya ditolak';
  end if;
end $$;

do $$
declare
  v_rows integer := 0;
begin
  begin
    update public.booths
       set status = 'Booked'
     where id = '00000000-0000-4000-8000-00000000b001';
    get diagnostics v_rows = row_count;
  exception
    when insufficient_privilege then v_rows := 0;
  end;

  if v_rows <> 0 then
    raise exception 'RLS-03 anon: UPDATE booth seharusnya ditolak';
  end if;
end $$;

do $$
declare
  v_rows integer := 0;
begin
  begin
    insert into public.booths
      (blueprint_id, category, width, height, price, status)
    values
      ('rls-test-pub', 'Tech', 10, 10, 1, 'Available');
    get diagnostics v_rows = row_count;
  exception
    when insufficient_privilege then v_rows := 0;
  end;

  if v_rows <> 0 then
    raise exception 'RLS-04 anon: INSERT booth seharusnya ditolak';
  end if;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- 4. Tenant A: baca hanya published + booking sendiri; tulis ditolak.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config(
         'request.jwt.claims',
         jsonb_build_object(
           'sub', :'tenant_a_id',
           'role', 'authenticated',
           'user_metadata', jsonb_build_object('role', 'tenant')
         )::text,
         true
       ) as _claims,
       set_config('request.jwt.claim.sub', :'tenant_a_id', true) as _sub
\gset

do $$
declare
  v_count integer;
begin
  select count(*) into v_count
    from public.blueprints where id = 'rls-test-draft';
  if v_count <> 0 then
    raise exception 'RLS-02 tenant: draft blueprint expected 0, got %', v_count;
  end if;

  select count(*) into v_count
    from public.blueprints where id = 'rls-test-pub';
  if v_count <> 1 then
    raise exception 'Tenant: published blueprint expected 1, got %', v_count;
  end if;

  select count(*) into v_count
    from public.booths where blueprint_id = 'rls-test-draft';
  if v_count <> 0 then
    raise exception 'Tenant: draft booths expected 0, got %', v_count;
  end if;

  select count(*) into v_count
    from public.bookings where blueprint_id = 'rls-test-pub';
  if v_count <> 1 then
    raise exception 'RLS-09 tenant A: own bookings expected 1, got %', v_count;
  end if;

  select count(*) into v_count
    from public.bookings
   where id = '00000000-0000-4000-8000-00000000c002';
  if v_count <> 0 then
    raise exception 'RLS-09 tenant A: booking tenant B should be hidden, got %', v_count;
  end if;
end $$;

do $$
declare
  v_rows integer;
begin
  update public.booths
     set status = 'Booked'
   where id = '00000000-0000-4000-8000-00000000b001';
  get diagnostics v_rows = row_count;

  if v_rows <> 0 then
    raise exception 'RLS-07 tenant: UPDATE booth expected 0 rows, got %', v_rows;
  end if;
end $$;

do $$
declare
  v_rows integer := 0;
begin
  begin
    insert into public.booths
      (blueprint_id, category, width, height, price, status)
    values
      ('rls-test-pub', 'Tech', 10, 10, 1, 'Available');
    get diagnostics v_rows = row_count;
  exception
    when insufficient_privilege then v_rows := 0;
  end;

  if v_rows <> 0 then
    raise exception 'RLS-07 tenant: INSERT booth seharusnya ditolak';
  end if;
end $$;

do $$
declare
  v_rows integer;
begin
  delete from public.booths
   where id = '00000000-0000-4000-8000-00000000b001';
  get diagnostics v_rows = row_count;

  if v_rows <> 0 then
    raise exception 'RLS-07 tenant: DELETE booth expected 0 rows, got %', v_rows;
  end if;
end $$;

do $$
declare
  v_rows integer := 0;
begin
  begin
    insert into public.blueprints (id, name, status)
    values ('rls-test-tenant-insert', 'Tenant Insert', 'draft');
    get diagnostics v_rows = row_count;
  exception
    when insufficient_privilege then v_rows := 0;
  end;

  if v_rows <> 0 then
    raise exception 'RLS-08 tenant: INSERT blueprint seharusnya ditolak';
  end if;
end $$;

do $$
declare
  v_rows integer;
begin
  update public.blueprints
     set name = 'Tenant Update'
   where id = 'rls-test-draft';
  get diagnostics v_rows = row_count;

  if v_rows <> 0 then
    raise exception 'RLS-08 tenant: UPDATE blueprint expected 0 rows, got %', v_rows;
  end if;

  delete from public.blueprints
   where id = 'rls-test-draft';
  get diagnostics v_rows = row_count;

  if v_rows <> 0 then
    raise exception 'RLS-08 tenant: DELETE blueprint expected 0 rows, got %', v_rows;
  end if;
end $$;

do $$
declare
  v_rows integer := 0;
begin
  begin
    update public.bookings
       set status = 'confirmed'
     where id = '00000000-0000-4000-8000-00000000c001';
    get diagnostics v_rows = row_count;
  exception
    when insufficient_privilege then v_rows := 0;
  end;

  if v_rows <> 0 then
    raise exception 'RLS-05 tenant: UPDATE booking langsung seharusnya ditolak';
  end if;
end $$;

reset role;

do $$
declare
  v_status text;
  v_count integer;
begin
  select status into v_status
    from public.booths
   where id = '00000000-0000-4000-8000-00000000b001';
  if v_status is distinct from 'Available' then
    raise exception 'RLS-07: status booth berubah menjadi %', v_status;
  end if;

  select count(*) into v_count
    from public.blueprints where id = 'rls-test-tenant-insert';
  if v_count <> 0 then
    raise exception 'RLS-08: tenant berhasil membuat blueprint';
  end if;

  select count(*) into v_count
    from public.blueprints where id = 'rls-test-draft';
  if v_count <> 1 then
    raise exception 'RLS-08: draft blueprint hilang';
  end if;

  select status into v_status
    from public.bookings
   where id = '00000000-0000-4000-8000-00000000c002';
  if v_status is distinct from 'pending' then
    raise exception 'RLS-05: booking tenant B berubah menjadi %', v_status;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Organizer: baca semua, tulis booth, tetapi booking tetap RPC-only.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config(
         'request.jwt.claims',
         jsonb_build_object(
           'sub', :'organizer_id',
           'role', 'authenticated',
           'user_metadata', jsonb_build_object('role', 'organizer')
         )::text,
         true
       ) as _claims,
       set_config('request.jwt.claim.sub', :'organizer_id', true) as _sub
\gset

do $$
declare
  v_count integer;
  v_rows integer;
begin
  select count(*) into v_count
    from public.blueprints
   where id in ('rls-test-draft', 'rls-test-pub');
  if v_count <> 2 then
    raise exception 'Organizer: blueprints expected 2, got %', v_count;
  end if;

  select count(*) into v_count
    from public.booths
   where blueprint_id in ('rls-test-draft', 'rls-test-pub');
  if v_count <> 5 then
    raise exception 'Organizer: booths expected 5, got %', v_count;
  end if;

  select count(*) into v_count
    from public.bookings
   where blueprint_id = 'rls-test-pub';
  if v_count <> 3 then
    raise exception 'Organizer: bookings expected 3, got %', v_count;
  end if;

  update public.booths
     set status = 'Booked'
   where id = '00000000-0000-4000-8000-00000000b001';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'Organizer: UPDATE booth expected 1 row, got %', v_rows;
  end if;

  update public.booths
     set status = 'Available'
   where id = '00000000-0000-4000-8000-00000000b001';
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- 6. Tenant A: RPC menolak aksi lintas tenant dan event draft.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config(
         'request.jwt.claims',
         jsonb_build_object(
           'sub', :'tenant_a_id',
           'role', 'authenticated',
           'user_metadata', jsonb_build_object('role', 'tenant')
         )::text,
         true
       ) as _claims,
       set_config('request.jwt.claim.sub', :'tenant_a_id', true) as _sub
\gset

do $$
declare
  v_hint text;
begin
  begin
    perform public.cancel_booking('00000000-0000-4000-8000-00000000c002');
    raise exception 'RLS-05 tenant A: cancel booking tenant B seharusnya ditolak';
  exception
    when sqlstate '42501' then
      get stacked diagnostics v_hint = pg_exception_hint;
      if v_hint is distinct from 'SWY_NOT_OWNER' then
        raise exception 'RLS-05 tenant A: hint %, expected SWY_NOT_OWNER', v_hint;
      end if;
  end;
end $$;

do $$
declare
  v_hint text;
begin
  begin
    perform public.confirm_booking('00000000-0000-4000-8000-00000000c001');
    raise exception 'RLS-10 tenant A: confirm_booking seharusnya ditolak';
  exception
    when sqlstate '42501' then
      get stacked diagnostics v_hint = pg_exception_hint;
      if v_hint is distinct from 'SWY_FORBIDDEN' then
        raise exception 'RLS-10 tenant A: hint %, expected SWY_FORBIDDEN', v_hint;
      end if;
  end;
end $$;

do $$
declare
  v_hint text;
begin
  begin
    perform public.create_booking(
      '00000000-0000-4000-8000-00000000b002',
      'va'
    );
    raise exception 'Tenant: create_booking draft seharusnya ditolak';
  exception
    when sqlstate 'P0001' then
      get stacked diagnostics v_hint = pg_exception_hint;
      if v_hint is distinct from 'SWY_EVENT_NOT_PUBLISHED' then
        raise exception 'Tenant: hint %, expected SWY_EVENT_NOT_PUBLISHED', v_hint;
      end if;
  end;
end $$;

do $$
declare
  v_hint text;
begin
  begin
    perform public.create_booking(
      '00000000-0000-4000-8000-00000000b004',
      'va'
    );
    raise exception 'Tenant: create_booking booth terisi seharusnya ditolak';
  exception
    when sqlstate 'P0001' then
      get stacked diagnostics v_hint = pg_exception_hint;
      if v_hint is distinct from 'SWY_BOOTH_UNAVAILABLE' then
        raise exception 'Tenant: hint %, expected SWY_BOOTH_UNAVAILABLE', v_hint;
      end if;
  end;
end $$;

-- Retry create_booking pada booth yang sama harus mengembalikan booking yang
-- sama (BE-03), bukan membuat baris kedua.
do $$
declare
  v_first public.bookings;
  v_second public.bookings;
begin
  select * into v_first
    from public.create_booking('00000000-0000-4000-8000-00000000b001', 'va');

  select * into v_second
    from public.create_booking('00000000-0000-4000-8000-00000000b001', 'va');

  if v_first.id <> v_second.id then
    raise exception 'BE-03: create_booking retry membuat booking baru';
  end if;

  if v_first.status is distinct from 'pending'
     or v_first.user_id is distinct from current_setting('rls_test.tenant_a_id')::uuid then
    raise exception 'create_booking: hasil booking tidak sesuai';
  end if;
end $$;

reset role;

do $$
declare
  v_status text;
  v_count integer;
begin
  select status into v_status
    from public.booths
   where id = '00000000-0000-4000-8000-00000000b001';
  if v_status is distinct from 'Reserved' then
    raise exception 'create_booking: booth expected Reserved, got %', v_status;
  end if;

  select count(*) into v_count
    from public.bookings
   where booth_id = '00000000-0000-4000-8000-00000000b001'
     and status in ('pending', 'awaiting_confirmation', 'confirmed');
  if v_count <> 1 then
    raise exception 'BE-02: active booking per booth expected 1, got %', v_count;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Anon: RPC tulis ditolak grant; sweep expiry diizinkan.
-- ---------------------------------------------------------------------------
set local role anon;
select set_config(
         'request.jwt.claims',
         jsonb_build_object('role', 'anon')::text,
         true
       ) as _claims,
       set_config('request.jwt.claim.sub', '', true) as _sub
\gset

do $$
declare
  v_hint text;
  v_denied boolean := false;
begin
  begin
    perform public.create_booking(
      '00000000-0000-4000-8000-00000000b001',
      'va'
    );
    raise exception 'RLS-11 anon: create_booking seharusnya ditolak';
  exception
    when insufficient_privilege then
      v_denied := true;
      get stacked diagnostics v_hint = pg_exception_hint;

      if v_hint is not null and v_hint <> 'SWY_AUTH_REQUIRED' then
        raise exception 'RLS-11 anon: hint tidak terduga: %', v_hint;
      end if;
  end;

  if not v_denied then
    raise exception 'RLS-11 anon: create_booking tidak ditolak';
  end if;
end $$;

do $$
declare
  v_released integer;
begin
  select public.release_expired_bookings() into v_released;

  if v_released is null then
    raise exception 'release_expired_bookings: hasil null';
  end if;
end $$;

reset role;

do $$
declare
  v_status text;
  v_reason text;
  v_booth text;
  v_count integer;
begin
  select status, cancelled_reason
    into v_status, v_reason
    from public.bookings
   where id = '00000000-0000-4000-8000-00000000c003';

  if v_status is distinct from 'cancelled'
     or v_reason is distinct from 'expired' then
    raise exception 'EXP: booking kedaluwarsa expected cancelled/expired, got %/%',
      v_status, v_reason;
  end if;

  select status into v_booth
    from public.booths
   where id = '00000000-0000-4000-8000-00000000b006';

  if v_booth is distinct from 'Available' then
    raise exception 'EXP: booth expected Available, got %', v_booth;
  end if;

  select count(*) into v_count
    from public.bookings
   where booth_id = '00000000-0000-4000-8000-00000000b001'
     and status in ('pending', 'awaiting_confirmation', 'confirmed');

  if v_count <> 1 then
    raise exception 'RLS-11 anon: jumlah booking aktif b001 berubah menjadi %', v_count;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 8. Organizer: konfirmasi dan pembatalan lewat RPC.
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config(
         'request.jwt.claims',
         jsonb_build_object(
           'sub', :'organizer_id',
           'role', 'authenticated',
           'user_metadata', jsonb_build_object('role', 'organizer')
         )::text,
         true
       ) as _claims,
       set_config('request.jwt.claim.sub', :'organizer_id', true) as _sub
\gset

do $$
declare
  v_booking public.bookings;
begin
  select * into v_booking
    from public.confirm_booking('00000000-0000-4000-8000-00000000c001');

  if v_booking.status <> 'confirmed' or v_booking.paid_at is null then
    raise exception 'Organizer: confirm_booking tidak menghasilkan confirmed/paid_at';
  end if;

  select * into v_booking
    from public.cancel_booking('00000000-0000-4000-8000-00000000c002');

  if v_booking.status is distinct from 'cancelled'
     or v_booking.cancelled_reason is distinct from 'manual' then
    raise exception 'Organizer: cancel_booking tidak menghasilkan cancelled/manual';
  end if;
end $$;

reset role;

do $$
declare
  v_booth text;
begin
  select status into v_booth
    from public.booths
   where id = '00000000-0000-4000-8000-00000000b003';
  if v_booth is distinct from 'Booked' then
    raise exception 'confirm_booking: booth expected Booked, got %', v_booth;
  end if;

  select status into v_booth
    from public.booths
   where id = '00000000-0000-4000-8000-00000000b004';
  if v_booth is distinct from 'Available' then
    raise exception 'cancel_booking: booth expected Available, got %', v_booth;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 9. Diagnostik F5: apakah organizer masih bisa menulis booking langsung?
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config(
         'request.jwt.claims',
         jsonb_build_object(
           'sub', :'organizer_id',
           'role', 'authenticated',
           'user_metadata', jsonb_build_object('role', 'organizer')
         )::text,
         true
       ) as _claims,
       set_config('request.jwt.claim.sub', :'organizer_id', true) as _sub
\gset

do $$
declare
  v_rows integer := 0;
  v_allowed boolean := false;
begin
  begin
    update public.bookings
       set status = 'pending'
     where id = '00000000-0000-4000-8000-00000000c002';
    get diagnostics v_rows = row_count;
    v_allowed := v_rows > 0;
  exception
    when insufficient_privilege then v_allowed := false;
  end;

  if v_allowed then
    raise warning
      'F5 aktif: organizer dapat UPDATE bookings langsung tanpa RPC. Cabut grant tulis default Supabase.';
  else
    raise notice 'F5 tidak aktif: grant tulis bookings sudah dicabut.';
  end if;
end $$;

reset role;

rollback;

\echo 'BE-01 RLS matrix tests passed; semua fixture di-rollback.'
