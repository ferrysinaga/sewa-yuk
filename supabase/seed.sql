-- Seed opsional untuk pengembangan dan QA.
--
-- Jalankan setelah seluruh migrasi di supabase/migrations/ selesai. File ini
-- idempoten: booth dengan ID yang sama tidak diduplikasi. Hapus atau sesuaikan
-- data di bawah bila Anda memakai proyek Supabase yang sudah berisi data asli.
--
-- Blueprint hall-a, hall-b, dan hall-5 sudah dibuat oleh migrasi
-- 20261103000100_create_blueprints.sql dan ditandai published oleh
-- 20261103000300_blueprint_publishing.sql. Seed ini hanya menambahkan booth
-- contoh pada hall-a agar halaman /event dan /event/hall-a langsung berisi.

insert into public.booths
  (id, blueprint_id, category, position_x, position_y, width, height, price, status)
values
  ('11111111-1111-4111-8111-111111111101', 'hall-a', 'Tech',    40,  80, 160, 120, 4500000, 'Available'),
  ('11111111-1111-4111-8111-111111111102', 'hall-a', 'F&B',     40, 240, 140, 100, 3800000, 'Available'),
  ('11111111-1111-4111-8111-111111111103', 'hall-a', 'Apparel', 40, 380, 120, 100, 3200000, 'Available'),
  ('11111111-1111-4111-8111-111111111104', 'hall-a', 'Tech',   320,  80, 160, 120, 5200000, 'Available'),
  ('11111111-1111-4111-8111-111111111105', 'hall-a', 'F&B',    320, 240, 140, 100, 4100000, 'Available'),
  ('11111111-1111-4111-8111-111111111106', 'hall-a', 'Apparel', 560,  80, 120, 100, 3500000, 'Available')
on conflict (id) do nothing;
