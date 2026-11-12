# Role dan Otorisasi: app_metadata (BE-07)

Dokumen ini menjelaskan remediasi **F1** dari `supabase/RLS_MATRIX.md`: role
otorisasi tidak lagi dibaca dari `user_metadata.role`, karena pengguna dapat
mengubah metadata itu sendiri lewat Supabase Auth. Sumber kebenaran sekarang
adalah **`app_metadata.role`**, yang hanya dapat ditulis dengan service role
atau Admin API.

Perubahan ini mencakup migrasi database, helper SQL, policy RLS, RPC, frontend,
dan skrip backfill. Migrasi tidak boleh dianggap selesai sebelum urutan rilis di
bagian 6 dijalankan di staging.

## 1. Ringkasan perubahan

| Lapisan                | Sebelum                                          | Sesudah                                                        |
| ---------------------- | ------------------------------------------------ | -------------------------------------------------------------- |
| Sumber role            | `auth.jwt() -> 'user_metadata' ->> 'role'`       | `auth.jwt() -> 'app_metadata' ->> 'role'`                       |
| Helper SQL             | Tidak ada                                        | `public.current_user_role()` (fallback `tenant`)                |
| Policy tabel           | Ekspresi `user_metadata` berulang                | Memanggil `public.current_user_role()`                          |
| RPC                    | `coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '')` | `public.current_user_role()`                            |
| Frontend               | `user.user_metadata?.role ?? app_metadata?.role` | Hanya `app_metadata.role`; fallback `tenant`                    |
| Registrasi             | Pengguna memilih organizer/tenant                | Selalu tenant; organizer ditunjuk admin                         |
| Backfill               | Tidak ada                                        | `scripts/backfill-roles.mjs` dengan allowlist eksplisit         |

File terkait:

- `supabase/migrations/20261112000000_app_metadata_role.sql`
- `src/lib/auth.ts`, `src/lib/auth.test.ts`
- `src/pages/Register.tsx`
- `scripts/backfill-roles.mjs`
- `supabase/tests/rls_matrix.sql` bagian 11

## 2. Model ancaman

**Aset yang dilindungi:** seluruh baris `bookings` (nama, email, telepon tenant
lain), kemampuan menulis `booths`/`blueprints`, objek bucket
`blueprint-assets`, serta RPC `confirm_booking`/`cancel_booking`.

**Aktor jahat:** pengguna tenant terautentikasi biasa dengan akses ke anon key
dan sesi miliknya. Ia tidak memiliki service role dan tidak dapat menulis
database secara langsung.

**Jalur serangan F1 sebelum remediasi:**

1. Tenant memanggil `PUT /auth/v1/user` dengan `{"data":{"role":"organizer"}}`.
   Supabase Auth menulis nilai itu ke `user_metadata` karena metadata tersebut
   memang dapat diubah pemilik akun.
2. Tenant menyegarkan token. JWT baru memuat
   `user_metadata.role = organizer`.
3. Policy dan RPC yang membaca `user_metadata` menganggapnya organizer.
4. Tenant dapat membaca seluruh booking, menulis booth/blueprint, mengunggah
   atau menghapus aset Storage, dan mengonfirmasi/membatalkan booking orang lain.

**Setelah remediasi:** langkah 1 tetap dapat mengubah `user_metadata`, tetapi
tidak ada policy, RPC, atau kode frontend yang membacanya untuk otorisasi.
`app_metadata` tidak dapat ditulis dengan token pengguna; hanya service role
yang dapat mengubahnya. Eskalasi lewat `user_metadata` menjadi tidak berdampak.

**Di luar cakupan:** service role yang bocor, akun organizer yang disetujui
secara keliru, dan pengambilalihan akun lewat email/password tetap menjadi
risiko operasional. Lihat juga F2/F4 (kepemilikan path Storage) dan F5 (grant
tulis langsung ke `bookings`) di `RLS_MATRIX.md`.

## 3. Aturan role

- Nilai yang dikenali: `organizer` dan `tenant`.
- `app_metadata.role` tidak ada, kosong, atau nilai tak dikenal → **tenant**.
  Default ini aman dan membuat akun lama tetap dapat memakai aplikasi.
- `user_metadata.role` **diabaikan sepenuhnya** untuk otorisasi. Jangan
  menambahkan fallback ke sana dengan alasan kompatibilitas.
- `user_metadata` tetap boleh dipakai untuk data tampilan, misalnya `full_name`.
- Registrasi publik selalu membuat tenant. Tidak ada pemilihan role di UI.
- Penunjukan organizer dilakukan admin lewat Admin API/backfill, bukan lewat
  klien.

## 4. Helper SQL

```sql
create or replace function public.current_user_role()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'role', ''),
    'tenant'
  )
$$;
```

Catatan:

- `security invoker` cukup karena hanya membaca JWT pemanggil.
- `stable` membantu planner dan aman dipakai di policy.
- `search_path = ''` mencegah pembajakan objek.
- `EXECUTE` diberikan ke `anon` dan `authenticated` agar policy dapat
  memanggilnya. Fungsi ini tidak membocorkan data; hasilnya hanya role pemanggil.
- Jangan menambahkan parameter atau membaca tabel `auth.users` di helper ini.
  Helper harus tetap murah karena dipanggil per baris policy.

## 5. Perubahan policy dan RPC

Migrasi mengganti policy berikut agar memakai helper:

- `public.booths`: `Organizers can manage booths`,
  `Booths are readable for published blueprints`.
- `public.blueprints`: `Organizers can manage blueprints`,
  `Published blueprints are publicly readable`.
- `public.bookings`: `Organizers can manage bookings`.
- `storage.objects`: upload, update, dan delete untuk bucket
  `blueprint-assets`.

RPC `create_booking`, `cancel_booking`, dan `confirm_booking` di-replace dengan
body yang sama seperti BE-03, hanya sumber role yang berubah. Hak `EXECUTE`
tetap minimum seperti BE-03: tulis RPC hanya untuk `authenticated`, sedangkan
`release_expired_bookings()` tetap untuk `anon, authenticated` sebagai fallback
sweep.

Policy baca publik tidak berubah: blueprint hanya terlihat bila `published`,
dan booth hanya terlihat bila blueprint induknya `published`, kecuali pemanggil
adalah organizer.

## 6. Urutan rilis (wajib)

Jangan men-deploy frontend lebih dulu. Frontend baru mengabaikan
`user_metadata.role`, sehingga organizer lama akan tampil sebagai tenant sampai
`app_metadata` di-backfill.

1. **Backup** database staging/produksi sesuai `supabase/MIGRATIONS.md` bagian 4.
2. **Terapkan migrasi** `20261112000000_app_metadata_role.sql` setelah seluruh
   migrasi sebelumnya.
3. **Backfill organizer** dengan allowlist eksplisit (bagian 7). Jalankan
   dry-run, tinjau daftar, lalu `--apply`.
4. **Verifikasi database** dengan `supabase/tests/rls_matrix.sql`, termasuk
   bagian 11 (F1). Pastikan organizer asli tetap bisa menulis dan tenant tidak.
5. **Deploy frontend** yang membaca `app_metadata.role`.
6. **Minta pengguna logout/login** atau refresh token agar JWT memuat
   `app_metadata` terbaru. Sesi lama masih membawa klaim lama sampai refresh.
7. **Uji asap** `/admin*`, `/event`, `/event/:id`, `/bookings`, dan
   `/admin/bookings` dengan organizer dan tenant.
8. Catat hasil RLS-14 di `qa_checklist_test_plan.md`.

Bila langkah 2 berhasil tetapi langkah 3 belum, jangan deploy frontend.
Database sudah aman (tenant tidak bisa eskalasi), tetapi organizer lama belum
dikenali.

## 7. Backfill organizer

Skrip: `scripts/backfill-roles.mjs` (tersedia sebagai
`npm run roles:backfill`).

Skrip **tidak** menyalin `user_metadata.role`, karena nilai itu tidak dapat
dipercaya. Organizer harus disebut eksplisit lewat email atau UUID.

Kebutuhan environment (jangan commit):

```bash
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

Dry-run (default):

```bash
npm run roles:backfill -- --organizer-emails=organizer@example.com,ops@example.com
```

Dengan UUID:

```bash
npm run roles:backfill -- \
  --organizer-ids=00000000-0000-4000-8000-000000000001,00000000-0000-4000-8000-000000000002
```

Tulis perubahan setelah daftar ditinjau:

```bash
npm run roles:backfill -- --organizer-emails=organizer@example.com --apply
```

Perilaku skrip:

- Menolak kunci yang bukan service role (termasuk anon key dan JWT non-service).
- Membaca seluruh user lewat Admin API dengan pagination 1000.
- Berhenti tanpa menulis apa pun bila ada target yang tidak ditemukan.
- Hanya mengubah akun dalam allowlist; akun lain tidak disentuh.
- Menampilkan perubahan `role lama -> organizer` sebelum menulis.
- `--apply` mempertahankan `app_metadata` lain dan hanya menimpa `role`.

Setelah backfill, pengguna harus logout/login agar token baru memuat role.
Minta mereka melakukannya; jangan mengandalkan refresh otomatis di tab lama.

## 8. Verifikasi

### 8.1 Otomatis lokal

`src/lib/auth.test.ts` memastikan:

- `app_metadata.role = organizer` → organizer;
- `app_metadata.role = tenant` → tenant;
- role hilang/tak dikenal → tenant;
- `user_metadata.role = organizer` diabaikan;
- `app_metadata` menang saat kedua metadata berbeda;
- user `null`/`undefined` → `null`.

Jalankan `npm run verify`.

### 8.2 Staging

```bash
psql "$SUPABASE_DB_URL" -v confirm_staging=yes \
  -v organizer_id='<uuid-organizer>' \
  -v tenant_a_id='<uuid-tenant-a>' \
  -v tenant_b_id='<uuid-tenant-b>' \
  -f supabase/tests/rls_matrix.sql
```

Bagian 11 memeriksa:

- JWT dengan `app_metadata.role = tenant` dan
  `user_metadata.role = organizer` tetap tenant;
- tenant tersebut hanya melihat booking sendiri dan tidak dapat menulis booth;
- JWT tanpa `app_metadata.role` fallback ke tenant;
- organizer asli dengan `app_metadata.role = organizer` tetap dapat menulis
  booth meskipun `user_metadata.role = tenant`.

Uji manual RLS-14 di `qa_checklist_test_plan.md`:

1. Login tenant, panggil `PUT /auth/v1/user` dengan
   `{"data":{"role":"organizer"}}`, lalu refresh token.
2. Pastikan UI tetap mengarah ke `/event` dan REST `GET /rest/v1/bookings`
   hanya mengembalikan booking milik tenant.
3. Pastikan `PATCH /rest/v1/booths` dan RPC `confirm_booking` ditolak.
4. Login organizer asli dan pastikan `/admin*` tetap berfungsi.

## 9. Rollback

Rollback penuh berarti mengembalikan pembacaan `user_metadata`, yang membuka
kembali F1. **Jangan lakukan kecuali ada insiden yang lebih besar.**

Opsi yang disarankan:

1. **Forward fix.** Perbaiki bug di migrasi baru; pertahankan
   `app_metadata.role`.
2. **Rollback frontend saja.** Kembalikan UI lama sementara database tetap
   memakai `app_metadata`. Organizer yang sudah di-backfill tetap dikenali oleh
   frontend lama hanya jika frontend lama membaca `app_metadata` sebagai
   fallback; versi sebelum BE-07 memprioritaskan `user_metadata`, sehingga
   organizer akan tampil sebagai tenant. Ini tidak aman untuk operasi normal.
3. **Rollback policy (tidak disarankan).** Jalankan ulang migrasi
   `20261103000100`, `20261103000300`, `20261103000400`, dan
   `20261103000500` untuk mengembalikan policy `user_metadata`, lalu jalankan
   ulang RPC BE-03. Ini membuka F1 kembali dan hanya boleh sementara dengan
   monitoring.

Bila rollback terpaksa dilakukan:

- cabut akses organizer yang tidak diyakini;
- pantau `bookings` dan `booths` untuk perubahan tak wajar;
- segera siapkan migrasi perbaikan dan ulangi urutan rilis.

`app_metadata` yang sudah di-backfill tidak perlu dihapus saat rollback policy;
nilai itu tidak berbahaya dan diperlukan saat remediasi dipasang kembali.

## 10. Batasan dan tindak lanjut

- Migrasi, backfill, dan RLS-14 **belum dijalankan** di mesin lokal karena tidak
  ada `psql`, Supabase CLI, atau kredensial staging. Verifikasi database
  menunggu OPS-04.
- F5 (grant tulis langsung ke `bookings`) masih terbuka dan ditangani BE-08.
  Policy organizer `FOR ALL` pada `bookings` masih ada; setelah grant tulis
  dicabut, akses tulis organizer hanya lewat RPC.
- F2/F4 (kepemilikan path Storage) masih terbuka. Semua organizer masih dapat
  menyentuh objek organizer lain di bucket yang sama.
- `user_metadata.role` pada akun lama tidak dibersihkan. Nilai itu kini tidak
  berbahaya, tetapi dapat membingungkan saat audit. Pembersihan opsional dapat
  dilakukan setelah rollout stabil.
- Organizer baru harus ditunjuk lewat proses admin. Bila nanti dibutuhkan
  undangan mandiri, buat Edge Function/server yang memverifikasi undangan lalu
  menulis `app_metadata` dengan service role. Jangan pernah menerima role dari
  body permintaan pengguna.

## 11. Referensi

- `supabase/RLS_MATRIX.md` (F1, F2/F4, F5)
- `supabase/MIGRATIONS.md` (urutan migrasi, backup, rollback)
- `supabase/ERROR_CONTRACT.md` (hint RPC)
- `supabase/tests/rls_matrix.sql` bagian 11
- `qa_checklist_test_plan.md` (RLS-14)
