-- Jalankan file ini di Supabase SQL Editor (atau via Supabase CLI)
-- agar fitur "Simpan Perubahan Denah" dapat menulis ke tabel booths.

create table if not exists public.booths (
  id uuid primary key default gen_random_uuid(),
  blueprint_id text not null default 'hall-a',
  category text not null check (category in ('Tech', 'F&B', 'Apparel')),
  position_x integer not null default 0,
  position_y integer not null default 0,
  width integer not null,
  height integer not null,
  price integer not null default 0,
  status text not null default 'Available' check (status in ('Available', 'Reserved', 'Booked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booths_blueprint_id_idx on public.booths (blueprint_id);

grant select on public.booths to anon, authenticated;
grant insert, update, delete on public.booths to authenticated;

alter table public.booths enable row level security;

drop policy if exists "Booths are publicly readable" on public.booths;
create policy "Booths are publicly readable"
  on public.booths
  for select
  using (true);

drop policy if exists "Organizers can manage booths" on public.booths;
create policy "Organizers can manage booths"
  on public.booths
  for all
  to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'organizer')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'organizer');
