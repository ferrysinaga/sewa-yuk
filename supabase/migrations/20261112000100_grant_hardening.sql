-- BE-08: cabut grant tulis dan EXECUTE default yang tidak perlu.
--
-- Temuan F5 (BE-01): project Supabase standar memberi
-- SELECT/INSERT/UPDATE/DELETE/TRUNCATE dan EXECUTE kepada anon/authenticated
-- untuk objek baru di schema public. RLS memang menolak tenant, tetapi:
--   1. organizer dapat menulis bookings langsung tanpa RPC karena policy
--      "Organizers can manage bookings" adalah FOR ALL;
--   2. anon masih dapat mencapai badan RPC tulis karena grant EXECUTE default,
--      lalu menerima SWY_AUTH_REQUIRED alih-alih permission denied.
--
-- Migrasi ini menerapkan pertahanan berlapis:
--   1. bookings: cabut semua grant dari anon; cabut tulis/TRUNCATE dari
--      authenticated; sisakan SELECT. Policy organizer diubah menjadi
--      FOR SELECT sehingga tulis hanya lewat RPC SECURITY DEFINER.
--   2. booths/blueprints: cabut tulis/TRUNCATE dari anon; cabut TRUNCATE dari
--      authenticated. Insert/update/delete authenticated tetap ada karena
--      editor organizer menulis langsung; RLS tetap membatasi ke organizer.
--   3. RPC tulis: cabut EXECUTE dari PUBLIC dan anon; grant hanya ke
--      authenticated.
--   4. release_expired_bookings: tetap dapat dipanggil anon sebagai fallback
--      sweep halaman publik, tetapi bukan bagian dari RPC tulis.
--
-- Idempoten: REVOKE/GRANT aman diulang; policy di-drop lalu dibuat ulang.
--
-- Rollback dan matriks grant ada di supabase/GRANTS.md.

do $$
begin
  if to_regclass('public.bookings') is null then
    raise exception 'Tabel public.bookings belum ada. Jalankan migrasi dasar terlebih dahulu.';
  end if;

  if to_regprocedure('public.current_user_role()') is null then
    raise exception 'Helper public.current_user_role() belum ada. Jalankan migrasi BE-07 terlebih dahulu.';
  end if;

  if to_regprocedure('public.create_booking(uuid,text)') is null then
    raise exception 'RPC create_booking belum ada. Jalankan migrasi dasar terlebih dahulu.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. public.bookings: baca saja untuk authenticated, tidak sama sekali untuk anon.
-- ---------------------------------------------------------------------------
revoke all on table public.bookings from public, anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.bookings from public, authenticated;
grant select on table public.bookings to authenticated;

-- Policy organizer tidak lagi FOR ALL. Dengan grant tulis yang dicabut dan
-- policy SELECT saja, direct PATCH/POST/DELETE ditolak di dua lapisan.
drop policy if exists "Organizers can manage bookings" on public.bookings;
create policy "Organizers can manage bookings"
  on public.bookings
  for select
  to authenticated
  using (public.current_user_role() = 'organizer');

-- ---------------------------------------------------------------------------
-- 2. public.booths: anon hanya baca; authenticated tetap boleh menulis untuk
--    organizer (RLS yang membatasi). TRUNCATE tidak dibutuhkan aplikasi.
-- ---------------------------------------------------------------------------
revoke insert, update, delete, truncate, references, trigger
  on table public.booths from public, anon;
revoke truncate, references, trigger
  on table public.booths from public, authenticated;
grant select on table public.booths to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. public.blueprints: sama seperti booths.
-- ---------------------------------------------------------------------------
revoke insert, update, delete, truncate, references, trigger
  on table public.blueprints from public, anon;
revoke truncate, references, trigger
  on table public.blueprints from public, authenticated;
grant select on table public.blueprints to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. RPC tulis: hanya authenticated.
-- ---------------------------------------------------------------------------
revoke all on function public.create_booking(uuid, text) from public, anon;
revoke all on function public.mark_booking_paid(uuid) from public, anon;
revoke all on function public.cancel_booking(uuid) from public, anon;
revoke all on function public.confirm_booking(uuid) from public, anon;

grant execute on function public.create_booking(uuid, text) to authenticated;
grant execute on function public.mark_booking_paid(uuid) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;
grant execute on function public.confirm_booking(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Sweep expiry: fallback halaman publik tetap boleh anon.
-- ---------------------------------------------------------------------------
revoke all on function public.release_expired_bookings() from public;
grant execute on function public.release_expired_bookings() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Helper role: dibutuhkan policy untuk anon dan authenticated.
-- ---------------------------------------------------------------------------
revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to anon, authenticated;

do $$
begin
  raise notice
    'BE-08 aktif: tulis bookings hanya lewat RPC; anon tidak lagi memiliki EXECUTE RPC tulis.';
end $$;
