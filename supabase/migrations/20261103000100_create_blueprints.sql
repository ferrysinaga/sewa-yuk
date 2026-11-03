-- Tabel metadata event/blueprint yang ditampilkan pada halaman penyewa.

create table if not exists public.blueprints (
  id text primary key,
  name text not null,
  venue text,
  event_date text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.blueprints to anon, authenticated;
grant insert, update, delete on public.blueprints to authenticated;

alter table public.blueprints enable row level security;

drop policy if exists "Blueprints are publicly readable" on public.blueprints;
create policy "Blueprints are publicly readable"
  on public.blueprints
  for select
  using (true);

drop policy if exists "Organizers can manage blueprints" on public.blueprints;
create policy "Organizers can manage blueprints"
  on public.blueprints
  for all
  to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'organizer')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'organizer');

insert into public.blueprints (id, name, venue, event_date, description)
values
  (
    'hall-a',
    'Pameran Teknologi Nusantara 2026',
    'Jakarta Convention Center · Hall A',
    '12 — 15 Maret 2026',
    'Pameran tahunan produk teknologi, startup, dan solusi digital dari seluruh Indonesia.'
  ),
  (
    'hall-b',
    'Festival Kuliner Merdeka',
    'Grand City Convention · Hall B',
    '2 — 5 April 2026',
    'Festival kuliner dengan tenant F&B pilihan dari berbagai daerah.'
  ),
  (
    'hall-5',
    'Indonesia Fashion Week',
    'ICE BSD · Hall 5',
    '21 — 26 April 2026',
    'Pameran mode dan apparel dengan desainer lokal serta brand nasional.'
  )
on conflict (id) do nothing;
