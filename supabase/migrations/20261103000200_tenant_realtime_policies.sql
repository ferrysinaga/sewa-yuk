-- Izinkan penyewa terautentikasi mengunci booth yang masih tersedia.
-- Policy organizer pada migrasi sebelumnya tetap berlaku untuk perubahan penuh.

drop policy if exists "Tenants can reserve available booths" on public.booths;
create policy "Tenants can reserve available booths"
  on public.booths
  for update
  to authenticated
  using (status = 'Available')
  with check (status = 'Reserved');

-- Aktifkan siaran perubahan tabel booths untuk Supabase Realtime.

alter table public.booths replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'booths'
     )
  then
    alter publication supabase_realtime add table public.booths;
  end if;
end $$;
