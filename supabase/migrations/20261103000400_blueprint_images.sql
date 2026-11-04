-- Phase 2: gambar denah sebagai pelengkap visual.
-- Data booth tetap menjadi sumber utama tata letak; gambar hanya latar/referensi
-- dan cover pada halaman jelajah event tenant.

alter table public.blueprints
  add column if not exists image_url text,
  add column if not exists image_path text;

-- Bucket publik agar tenant dapat menampilkan gambar tanpa signed URL.
-- Penulisan tetap dibatasi untuk akun organizer melalui policy di bawah.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'blueprint-assets',
  'blueprint-assets',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Blueprint images are publicly readable" on storage.objects;
create policy "Blueprint images are publicly readable"
  on storage.objects
  for select
  using (bucket_id = 'blueprint-assets');

drop policy if exists "Organizers can upload blueprint images" on storage.objects;
create policy "Organizers can upload blueprint images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'blueprint-assets'
    and (auth.jwt() -> 'user_metadata' ->> 'role') = 'organizer'
  );

drop policy if exists "Organizers can update blueprint images" on storage.objects;
create policy "Organizers can update blueprint images"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'blueprint-assets'
    and (auth.jwt() -> 'user_metadata' ->> 'role') = 'organizer'
  )
  with check (
    bucket_id = 'blueprint-assets'
    and (auth.jwt() -> 'user_metadata' ->> 'role') = 'organizer'
  );

drop policy if exists "Organizers can delete blueprint images" on storage.objects;
create policy "Organizers can delete blueprint images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'blueprint-assets'
    and (auth.jwt() -> 'user_metadata' ->> 'role') = 'organizer'
  );
