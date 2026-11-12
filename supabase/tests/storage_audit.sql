-- BE-05: audit bucket gambar denah dan file yatim.
--
-- HANYA UNTUK STAGING. Skrip ini hanya membaca katalog, tabel blueprints, dan
-- storage.objects; tidak menghapus apa pun.
--
-- Menghapus baris storage.objects lewat SQL TIDAK menghapus file di backend
-- Storage. Gunakan scripts/storage-orphans.mjs (Storage API) atau Dashboard
-- untuk membersihkan objek setelah daftar di bawah ditinjau.
--
-- Contoh:
--   psql "$SUPABASE_DB_URL" -v confirm_staging=yes -f supabase/tests/storage_audit.sql

\set ON_ERROR_STOP on

\if :{?confirm_staging}
\else
  \echo 'Ditolak: jalankan hanya di staging dengan -v confirm_staging=yes.'
  \quit
\endif

select case when :'confirm_staging' = 'yes' then 'true' else 'false' end
       as storage_confirmed
\gset
\if :storage_confirmed
\else
  \echo 'Ditolak: nilai confirm_staging harus yes.'
  \quit
\endif

-- ---------------------------------------------------------------------------
-- 1. Katalog bucket dan policy.
-- ---------------------------------------------------------------------------
do $$
declare
  v_count integer;
begin
  select count(*) into v_count
    from storage.buckets b
   where b.id = 'blueprint-assets'
     and b."public" = true
     and b.file_size_limit = 5242880
     and b.allowed_mime_types @> array['image/png', 'image/jpeg', 'image/webp']
     and b.allowed_mime_types <@ array['image/png', 'image/jpeg', 'image/webp'];
  if v_count <> 1 then
    raise exception 'Storage: bucket blueprint-assets harus publik, 5 MB, dan hanya png/jpeg/webp';
  end if;

  select count(*) into v_count
    from pg_policies
   where schemaname = 'storage'
     and tablename = 'objects'
     and (policyname, cmd) in (
       ('Blueprint images are publicly readable', 'SELECT'),
       ('Organizers can upload blueprint images', 'INSERT'),
       ('Organizers can update blueprint images', 'UPDATE'),
       ('Organizers can delete blueprint images', 'DELETE')
     );
  if v_count <> 4 then
    raise exception 'Storage: policy baca/tulis blueprint-assets tidak lengkap, got %', v_count;
  end if;

  select count(*) into v_count
    from pg_policies
   where schemaname = 'storage'
     and tablename = 'objects'
     and policyname in (
       'Organizers can upload blueprint images',
       'Organizers can update blueprint images',
       'Organizers can delete blueprint images'
     )
     and roles = array['authenticated']::name[];
  if v_count <> 3 then
    raise exception 'Storage: policy tulis harus hanya untuk authenticated, got %', v_count;
  end if;

  if not exists (
    select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'storage'
       and c.relname = 'objects'
       and c.relrowsecurity
  ) then
    raise exception 'Storage: RLS harus aktif pada storage.objects';
  end if;

  raise notice 'Storage: bucket, policy, dan RLS sesuai.';
end $$;

-- ---------------------------------------------------------------------------
-- 2. Referensi yang menunjuk file hilang.
-- ---------------------------------------------------------------------------
\echo ''
\echo '== image_path tanpa objek di Storage (referensi rusak) =='
select b.id,
       b.name,
       b.image_path,
       b.image_url
  from public.blueprints b
  left join storage.objects o
    on o.bucket_id = 'blueprint-assets'
   and o.name = b.image_path
 where nullif(btrim(b.image_path), '') is not null
   and o.id is null
 order by b.id;

-- ---------------------------------------------------------------------------
-- 3. Objek tanpa referensi (file yatim).
-- ---------------------------------------------------------------------------
\echo ''
\echo '== objek Storage tanpa referensi blueprints.image_path (file yatim) =='
select o.name,
       o.created_at,
       o.updated_at,
       coalesce((o.metadata ->> 'size')::bigint, 0) as bytes,
       case
         when o.created_at < now() - interval '1 day' then 'boleh dibersihkan'
         else 'baru; tunda untuk menghindari upload yang belum disimpan'
       end as rekomendasi
  from storage.objects o
 where o.bucket_id = 'blueprint-assets'
   and not exists (
     select 1
       from public.blueprints b
      where b.image_path = o.name
   )
 order by o.created_at;

-- ---------------------------------------------------------------------------
-- 4. Objek di luar konvensi path blueprints/.
-- ---------------------------------------------------------------------------
\echo ''
\echo '== objek di luar folder blueprints/ (tinjau manual) =='
select o.name, o.created_at, o.owner
  from storage.objects o
 where o.bucket_id = 'blueprint-assets'
   and o.name not like 'blueprints/%'
 order by o.name;

-- ---------------------------------------------------------------------------
-- 5. Metadata image_path/image_url tidak konsisten.
-- ---------------------------------------------------------------------------
\echo ''
\echo '== blueprints dengan image_path/image_url tidak konsisten =='
select b.id,
       b.name,
       b.image_path,
       b.image_url
  from public.blueprints b
 where (nullif(btrim(b.image_path), '') is null)
    <> (nullif(btrim(b.image_url), '') is null)
 order by b.id;

\echo ''
\echo 'Audit storage selesai. Skrip ini tidak menghapus objek apa pun.'
\echo 'Untuk membersihkan file yatim, tinjau daftar di atas lalu jalankan:'
\echo '  node scripts/storage-orphans.mjs --older-than-hours=24'
\echo '  node scripts/storage-orphans.mjs --older-than-hours=24 --delete'
