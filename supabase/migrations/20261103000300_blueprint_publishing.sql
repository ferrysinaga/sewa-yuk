-- Phase 1 publikasi denah:
-- organizer dapat membuat blueprint (draft), menyusun booth, lalu mempublikasikannya.
-- Tenant hanya dapat membaca blueprint yang sudah dipublikasikan.

alter table public.blueprints
  add column if not exists status text not null default 'published';

-- Blueprint yang sudah ada tetap tampil ke tenant, sedangkan blueprint baru
-- yang dibuat dari halaman kelola denah dimulai sebagai draft.
alter table public.blueprints
  alter column status set default 'draft';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'blueprints_status_check'
      and conrelid = 'public.blueprints'::regclass
  ) then
    alter table public.blueprints
      add constraint blueprints_status_check
      check (status in ('draft', 'published', 'archived'));
  end if;
end $$;

create index if not exists blueprints_status_idx on public.blueprints (status);

drop policy if exists "Blueprints are publicly readable" on public.blueprints;

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
