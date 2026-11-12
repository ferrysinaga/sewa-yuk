-- BE-06: review index dan rencana query utama.
--
-- HANYA UNTUK STAGING. Skrip ini read-only: hanya SELECT/EXPLAIN, lalu rollback
-- untuk transaksi yang memakai SET ROLE. Tidak ada data yang diubah.
--
-- Contoh:
--   psql "$SUPABASE_DB_URL" \
--     -v confirm_staging=yes \
--     -v tenant_id='<uuid-tenant>' \
--     -v organizer_id='<uuid-organizer>' \
--     -v event_id='hall-a' \
--     -f supabase/tests/query_plans.sql
--
-- tenant_id/organizer_id hanya memengaruhi jumlah baris pada rencana RLS.
-- Tanpa nilai tersebut, skrip memakai UUID sintetis dan jumlah baris 0.

\set ON_ERROR_STOP on

\if :{?confirm_staging}
\else
  \echo 'Ditolak: jalankan hanya di staging dengan -v confirm_staging=yes.'
  \quit
\endif

select case when :'confirm_staging' = 'yes' then 'true' else 'false' end
       as query_plan_confirmed
\gset
\if :query_plan_confirmed
\else
  \echo 'Ditolak: nilai confirm_staging harus yes.'
  \quit
\endif

\if :{?tenant_id}
\else
  \set tenant_id '00000000-0000-0000-0000-000000000000'
  \echo 'tenant_id tidak diberikan; memakai UUID sintetis (rencana valid, baris 0).'
\endif

\if :{?organizer_id}
\else
  \set organizer_id '00000000-0000-0000-0000-000000000000'
  \echo 'organizer_id tidak diberikan; memakai UUID sintetis (rencana valid, baris 0).'
\endif

\if :{?event_id}
\else
  \set event_id 'hall-a'
  \echo 'event_id tidak diberikan; memakai hall-a.'
\endif

-- ---------------------------------------------------------------------------
-- 1. Index wajib dan definisi index penting.
-- ---------------------------------------------------------------------------
do $$
declare
  v_missing text;
begin
  select string_agg(expected.name, ', ' order by expected.name)
    into v_missing
    from (values
      ('public.booths_pkey'),
      ('public.booths_blueprint_id_idx'),
      ('public.blueprints_pkey'),
      ('public.blueprints_status_idx'),
      ('public.bookings_pkey'),
      ('public.bookings_booking_code_idx'),
      ('public.bookings_user_id_idx'),
      ('public.bookings_booth_id_idx'),
      ('public.bookings_blueprint_id_idx'),
      ('public.bookings_status_idx'),
      ('public.bookings_pending_expiry_idx'),
      ('public.bookings_one_active_per_booth_idx')
    ) as expected(name)
   where to_regclass(expected.name) is null;

  if v_missing is not null then
    raise exception 'Index wajib tidak ditemukan: %', v_missing;
  end if;

  if not exists (
    select 1
      from pg_index i
      join pg_class c on c.oid = i.indexrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = 'bookings_one_active_per_booth_idx'
       and i.indisunique
       and i.indpred is not null
  ) then
    raise exception 'bookings_one_active_per_booth_idx harus unique dan partial';
  end if;

  if not exists (
    select 1
      from pg_index i
      join pg_class c on c.oid = i.indexrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = 'bookings_pending_expiry_idx'
       and i.indpred is not null
  ) then
    raise exception 'bookings_pending_expiry_idx harus partial';
  end if;

  raise notice 'Index wajib dan definisi index penting sesuai.';
end $$;

-- ---------------------------------------------------------------------------
-- 2. Index duplikat.
-- ---------------------------------------------------------------------------
\echo ''
\echo '== Index duplikat (definisi identik) =='
select i.indrelid::regclass::text as table_name,
       array_agg(i.indexrelid::regclass::text order by i.indexrelid::regclass::text) as duplicate_indexes,
       i.indkey::text as indkey,
       i.indpred::text as indpred
  from pg_index i
 where i.indrelid in (
   'public.booths'::regclass,
   'public.blueprints'::regclass,
   'public.bookings'::regclass
 )
 group by i.indrelid, i.indkey::text, i.indpred::text
having count(*) > 1
 order by i.indrelid::regclass::text;

-- ---------------------------------------------------------------------------
-- 3. Ukuran tabel dan statistik planner.
-- ---------------------------------------------------------------------------
\echo ''
\echo '== Ukuran tabel dan statistik =='
select relname,
       n_live_tup,
       n_dead_tup,
       pg_size_pretty(pg_total_relation_size(relid)) as total_size,
       last_analyze,
       last_autoanalyze
  from pg_stat_user_tables
 where schemaname = 'public'
   and relname in ('booths', 'blueprints', 'bookings')
 order by relname;

-- ---------------------------------------------------------------------------
-- 4. Pemakaian index.
-- ---------------------------------------------------------------------------
\echo ''
\echo '== Pemakaian index (idx_scan rendah di staging baru adalah normal) =='
select c.relname as index_name,
       i.indisunique as is_unique,
       (i.indpred is not null) as is_partial,
       coalesce(s.idx_scan, 0) as idx_scan,
       pg_size_pretty(pg_relation_size(c.oid)) as index_size
  from pg_index i
  join pg_class c on c.oid = i.indexrelid
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_stat_user_indexes s on s.indexrelid = i.indexrelid
 where n.nspname = 'public'
   and i.indrelid in (
     'public.booths'::regclass,
     'public.blueprints'::regclass,
     'public.bookings'::regclass
   )
 order by coalesce(s.idx_scan, 0), pg_relation_size(c.oid) desc;

-- ---------------------------------------------------------------------------
-- 5. Rencana query utama.
-- ---------------------------------------------------------------------------
\echo ''
\echo '== 1. Daftar event published =='
explain (analyze, buffers)
select id, name, venue, event_date, description, status, image_url, image_path
  from public.blueprints
 where status = 'published'
 order by created_at desc;

\echo ''
\echo '== 2. Booth satu event =='
explain (analyze, buffers)
select *
  from public.booths
 where blueprint_id = :'event_id';

\echo ''
\echo '== 3. Booth untuk semua event published =='
explain (analyze, buffers)
select blueprint_id, category, status
  from public.booths
 where blueprint_id in (
   select id from public.blueprints where status = 'published'
 );

\echo ''
\echo '== 4. Semua booth di dashboard admin =='
explain (analyze, buffers)
select *
  from public.booths
 order by created_at desc;

\echo ''
\echo '== 5. Booking tenant (RLS user_id = auth.uid()) =='
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', :'tenant_id', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
explain (analyze, buffers)
select *
  from public.bookings
 order by created_at desc;
rollback;

\echo ''
\echo '== 6. Halaman booking admin (tanpa filter) =='
begin;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', :'organizer_id',
    'role', 'authenticated',
    'app_metadata', json_build_object('role', 'organizer')
  )::text,
  true
);
set local role authenticated;
explain (analyze, buffers)
select *
  from public.bookings
 order by created_at desc
 limit 25 offset 0;
rollback;

\echo ''
\echo '== 7. Pencarian booking admin (wildcard di depan) =='
begin;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', :'organizer_id',
    'role', 'authenticated',
    'app_metadata', json_build_object('role', 'organizer')
  )::text,
  true
);
set local role authenticated;
explain (analyze, buffers)
select *
  from public.bookings
 where booking_code ilike '%swy%'
    or tenant_name ilike '%a%'
    or tenant_email ilike '%a%'
    or booth_category ilike '%a%'
 order by created_at desc
 limit 25 offset 0;
rollback;

\echo ''
\echo '== 8. Metrik booking admin (ambil semua baris ringan) =='
begin;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', :'organizer_id',
    'role', 'authenticated',
    'app_metadata', json_build_object('role', 'organizer')
  )::text,
  true
);
set local role authenticated;
explain (analyze, buffers)
select id, status, price, expires_at, cancelled_reason
  from public.bookings;
rollback;

\echo ''
\echo '== 9. Sweep expiry =='
begin;
explain (analyze, buffers)
select *
  from public.bookings
 where status = 'pending'
   and expires_at is not null
   and expires_at <= now()
 order by expires_at
   for update skip locked;
rollback;

\echo ''
\echo '== 10. Preflight duplikat booking aktif =='
explain (analyze, buffers)
select booth_id, count(*) as active_count
  from public.bookings
 where booth_id is not null
   and status in ('pending', 'awaiting_confirmation', 'confirmed')
 group by booth_id
having count(*) > 1;

\echo ''
\echo '== 11. Lock booth saat checkout =='
begin;
explain (analyze, buffers)
select *
  from public.booths
 where id = '00000000-0000-0000-0000-000000000000'::uuid
   for update;
rollback;

\echo ''
\echo 'Review query plan selesai. Tidak ada data yang diubah.'
\echo 'Tindak lanjuti Seq Scan besar, sort disk, atau baris terfilter tinggi'
\echo 'sesuai supabase/MIGRATIONS.md bagian 6.'
