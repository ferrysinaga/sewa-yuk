-- Phase 1 publikasi denah:
-- organizer dapat membuat blueprint (draft), menyusun booth, lalu mempublikasikannya.
-- Tenant hanya dapat membaca blueprint yang sudah dipublikasikan.
--
-- Migrasi ini dibuat idempoten agar aman dijalankan ulang ketika eksekusi
-- sebelumnya berhenti di tengah jalan.

-- Pastikan tabel dasar sudah ada agar pesan errornya jelas.
do $$
begin
  if to_regclass('public.blueprints') is null then
    raise exception 'Tabel public.blueprints belum ada. Jalankan migrasi 20261103000100_create_blueprints.sql terlebih dahulu.';
  end if;

  if to_regclass('public.booths') is null then
    raise exception 'Tabel public.booths belum ada. Jalankan migrasi 20261103000000_create_booths.sql terlebih dahulu.';
  end if;
end $$;

alter table public.blueprints
  add column if not exists status text;

-- Normalisasi data lama/partial apply sebelum memasang constraint.
update public.blueprints
set status = 'published'
where status is null
   or status not in ('draft', 'published', 'archived');

alter table public.blueprints
  alter column status set default 'draft',
  alter column status set not null;

-- Pastikan constraint selalu memakai definisi terbaru.
alter table public.blueprints
  drop constraint if exists blueprints_status_check;

alter table public.blueprints
  add constraint blueprints_status_check
  check (status in ('draft', 'published', 'archived'));

create index if not exists blueprints_status_idx on public.blueprints (status);

-- Hapus policy lama maupun policy baru (jika migrasi pernah dijalankan sebagian)
-- sebelum membuat ulang, agar tidak muncul error "policy already exists".
drop policy if exists "Blueprints are publicly readable" on public.blueprints;
drop policy if exists "Published blueprints are publicly readable" on public.blueprints;

create policy "Published blueprints are publicly readable"
  on public.blueprints
  for select
  using (
    status = 'published'
    or (auth.jwt() -> 'user_metadata' ->> 'role') = 'organizer'
  );

-- Booth hanya boleh dibaca publik jika blueprint induknya sudah dipublikasikan.
-- Organizer tetap dapat membaca booth pada denah draft untuk proses penyusunan.
drop policy if exists "Booths are publicly readable" on public.booths;
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
    or (auth.jwt() -> 'user_metadata' ->> 'role') = 'organizer'
  );
