# Matriks RLS dan Otorisasi Database

Dokumen ini adalah hasil audit **BE-01** terhadap garis pertahanan database
sewa-yuk. Cakupannya adalah tabel `public.booths`, `public.blueprints`,
`public.bookings`, bucket Storage `blueprint-assets`, dan RPC pemesanan.

Audit dilakukan dari migrasi di `supabase/migrations/` dan kode frontend yang
menulis role. Dokumen ini awalnya **tidak** mengubah skema, policy, atau RPC.
Temuan kritis F1 kemudian diremediasi oleh **BE-07** melalui migrasi terpisah
`20261112000000_app_metadata_role.sql`; detail rollout ada di
`supabase/AUTH_ROLES.md`. Bagian F1 di bawah mencatat kondisi awal, dampak, dan
status remediasinya.

## 1. Ringkasan eksekutif

- RLS aktif pada ketiga tabel publik dan `storage.objects`. Grant tabel bukan
  satu-satunya batas: project Supabase standar memberi
  `SELECT/INSERT/UPDATE/DELETE/TRUNCATE` kepada `anon` dan `authenticated`
  untuk objek baru di schema `public`. **BE-08** mencabut grant yang tidak
  dibutuhkan pada objek yang sudah ada dan menyisakan grant minimum; RLS tetap
  kontrol utama untuk operasi yang masih diizinkan.
- Otorisasi role awalnya membaca
  `(auth.jwt() -> 'user_metadata' ->> 'role')`. Nilai ini **dapat diubah sendiri
  oleh pengguna** melalui Supabase Auth, sehingga tidak layak menjadi sumber
  otorisasi produksi. Ini adalah temuan **F1 (kritis)**. **BE-07** telah
  memindahkan otorisasi ke `app_metadata.role` lewat helper
  `public.current_user_role()`; policy, RPC, dan frontend tidak lagi membaca
  `user_metadata`.
- Route guard dan penyembunyian tombol di frontend hanya UX. Keputusan akses
  data tetap dilakukan oleh RLS dan pengecekan di dalam RPC.
- Blueprint dan booth publik hanya terbaca bila blueprint berstatus
  `published`. Tenant dan anon tidak dapat menulis booth/blueprint/booking
  karena tidak ada policy tulis yang cocok.
- `bookings` awalnya memiliki policy organizer `FOR ALL`. Karena default
  privilege Supabase memberi grant tulis kepada `authenticated`, organizer
  dapat menulis booking langsung tanpa RPC. Ini adalah temuan **F5**. **BE-08**
  mencabut grant tulis `bookings` dari `anon`/`authenticated` dan mengubah
  policy organizer menjadi `SELECT`, sehingga tulis hanya lewat RPC.
- Empat RPC tulis awalnya mendapat grant `EXECUTE` default untuk `anon`.
  **BE-08** mencabut `EXECUTE` dari `PUBLIC` dan `anon`, lalu memberikannya
  hanya ke `authenticated`. Anon sekarang ditolak di lapisan grant, bukan
  mencapai badan fungsi.
- Bucket `blueprint-assets` bersifat publik. Policy tulis organizer tidak
  memeriksa kepemilikan path, sehingga setiap organizer dapat mengubah atau
  menghapus objek mana pun di bucket (F2/F4).
- `release_expired_bookings()` dapat dieksekusi `anon`. Ini disengaja sebagai
  fallback sweep, tetapi perlu ditinjau ulang (F3).

## 2. Model role dan sumber otorisasi

| Aktor          | Cara masuk                                        | Klaim yang dibaca policy/RPC                   |
| -------------- | ------------------------------------------------- | ---------------------------------------------- |
| `anon`         | Tanpa login, memakai anon key                     | Tidak punya `sub`/`app_metadata.role`          |
| `tenant`       | Login akun dengan `app_metadata.role = tenant`    | `auth.uid()` dan `app_metadata.role`           |
| `organizer`    | Login akun dengan `app_metadata.role = organizer` | `auth.uid()` dan `app_metadata.role`           |
| `service_role` | Hanya server/CI, tidak pernah di frontend         | Melewati RLS. Jangan pernah dikirim ke browser |

Setelah BE-07:

- `src/pages/Register.tsx` tidak lagi menulis role. Pendaftaran publik selalu
  menghasilkan akun tenant.
- `src/lib/auth.ts` hanya membaca `user.app_metadata?.role`; nilai hilang atau
  tak dikenal diperlakukan sebagai `tenant`.
- Semua policy dan RPC memanggil `public.current_user_role()`, yang membaca
  `auth.jwt() -> 'app_metadata' ->> 'role'` dengan fallback `tenant`.
- Organizer lama di-backfill eksplisit lewat `scripts/backfill-roles.mjs`
  dengan allowlist email/UUID. Nilai `user_metadata.role` tidak disalin karena
  tidak dapat dipercaya.
- `user_metadata` tetap boleh dipakai untuk data tampilan seperti `full_name`,
  tetapi bukan untuk otorisasi.

## 3. Matriks tabel x operasi x role

Keterangan:

- **Diizinkan** berarti policy mengizinkan dan role dapat mencapai tabel.
- **Ditolak (grant)** berarti role tidak punya privilege tabel; PostgREST
  mengembalikan `401/403` atau SQLSTATE `42501`. Ini hanya terjadi bila project
  mencabut default privilege Supabase.
- **Ditolak (grant)** berarti role tidak punya privilege tabel/fungsi;
  PostgREST mengembalikan `401/403` dan PostgreSQL `42501`.
- **Ditolak (RLS)** berarti grant ada, tetapi tidak ada policy yang cocok.
  `SELECT`/`UPDATE`/`DELETE` biasanya menghasilkan `0` baris; `INSERT`
  menghasilkan `new row violates row-level security policy` (`42501`).
- `service_role` melewati RLS dan tidak dicantumkan di setiap baris.

Setelah **BE-08**, objek utama memakai grant minimum. Default privilege
Supabase masih berlaku untuk objek baru, sehingga setiap migrasi baru harus
mencabut grant yang tidak dibutuhkan secara eksplisit. Matriks grant dan
prosedur verifikasi ada di `supabase/GRANTS.md`.

### 3.1 `public.booths`

Policy aktif:

- `Booths are readable for published blueprints` (`SELECT`): blueprint induk
  `published`, **atau** role organizer.
- `Organizers can manage booths` (`ALL`, `authenticated`): role organizer.

| Operasi  | `anon`                          | `tenant`                        | `organizer` | Catatan                                                                 |
| -------- | ------------------------------- | ------------------------------- | ----------- | ----------------------------------------------------------------------- |
| `SELECT` | Hanya booth blueprint published | Hanya booth blueprint published | Semua booth | Policy publik tidak membocorkan booth draft.                            |
| `INSERT` | Ditolak (grant)                 | Ditolak (RLS)                   | Diizinkan   | Grant tulis anon dicabut (BE-08); tenant ditolak RLS.                   |
| `UPDATE` | Ditolak (grant)                 | Ditolak (RLS, 0 baris)          | Diizinkan   | Policy reservasi tenant sudah di-drop di migrasi bookings.              |
| `DELETE` | Ditolak (grant)                 | Ditolak (RLS, 0 baris)          | Diizinkan   | Hapus booth membuat `bookings.booth_id` menjadi `null` (riwayat tetap). |

Catatan penting:

- Tenant **tidak** dapat mengubah status booth langsung. Reservasi hanya lewat
  `create_booking`, sehingga selalu ada baris booking yang menyertainya.
- Organizer dapat menulis status booth langsung. Ini dibutuhkan editor denah,
  tetapi dapat membuat status sementara tidak konsisten dengan booking (F6).
  `release_expired_bookings()` merekonsiliasi status pada sweep berikutnya.
- Policy lama `Booths are publicly readable` dan
  `Tenants can reserve available booths` sudah di-drop.

### 3.2 `public.blueprints`

Policy aktif:

- `Published blueprints are publicly readable` (`SELECT`): `status = 'published'`
  **atau** role organizer.
- `Organizers can manage blueprints` (`ALL`, `authenticated`): role organizer.

| Operasi  | `anon`                      | `tenant`                    | `organizer` | Catatan                                                 |
| -------- | --------------------------- | --------------------------- | ----------- | ------------------------------------------------------- |
| `SELECT` | Hanya blueprint `published` | Hanya blueprint `published` | Semua       | Draft/archived tidak terlihat tenant.                   |
| `INSERT` | Ditolak (grant)             | Ditolak (RLS)               | Diizinkan   | Grant tulis anon dicabut (BE-08); tenant ditolak RLS.   |
| `UPDATE` | Ditolak (grant)             | Ditolak (RLS, 0 baris)      | Diizinkan   | Tenant tidak bisa publish draft.                        |
| `DELETE` | Ditolak (grant)             | Ditolak (RLS, 0 baris)      | Diizinkan   | Hapus blueprint tidak menghapus booth/booking otomatis. |

Policy lama `Blueprints are publicly readable` sudah di-drop. Hanya policy
publikasi yang berlaku.

### 3.3 `public.bookings`

Policy aktif:

- `Tenants can view own bookings` (`SELECT`, `authenticated`):
  `user_id = auth.uid()`.
- `Organizers can manage bookings` (`SELECT`, `authenticated`): role
  organizer. Sejak BE-08 policy ini bukan `FOR ALL`.
- Grant tabel: `SELECT` untuk `authenticated`; **tidak ada** grant untuk
  `anon` dan tidak ada grant tulis untuk `authenticated`. Perubahan status
  hanya lewat RPC `SECURITY DEFINER`.

| Operasi  | `anon`          | `tenant`                    | `organizer`                  | Catatan                                                          |
| -------- | --------------- | --------------------------- | ---------------------------- | ---------------------------------------------------------------- |
| `SELECT` | Ditolak (grant) | Hanya booking milik sendiri | Semua booking                | Anon tidak punya grant select; tenant dibatasi RLS.              |
| `INSERT` | Ditolak (grant) | Ditolak (RLS)               | Ditolak (grant), gunakan RPC | Grant tulis dicabut; policy organizer hanya SELECT.              |
| `UPDATE` | Ditolak (grant) | Ditolak (RLS, 0)            | Ditolak (grant), gunakan RPC | Direct PATCH tidak dapat melewati idempotensi/kontrak error RPC. |
| `DELETE` | Ditolak (grant) | Ditolak (RLS, 0)            | Ditolak (grant), gunakan RPC | Tidak ada alur hapus resmi; gunakan `cancel_booking`.            |

Catatan penting:

- Sebelum BE-08, policy organizer `FOR ALL` **bukan dead code** di project
  Supabase standar: default privilege memberi grant tulis, sehingga organizer
  dapat menulis booking langsung. BE-08 mencabut grant tulis dan mengubah
  policy menjadi `SELECT`; lihat `supabase/GRANTS.md`.
- `bookings.user_id` memakai `on delete cascade`. Menghapus akun auth akan
  menghapus riwayat booking; booth yang tertahan akan dilepas oleh sweep
  berikutnya.

### 3.4 `storage.objects` bucket `blueprint-assets`

Bucket: `public = true`, batas 5 MB, tipe `image/png`, `image/jpeg`,
`image/webp`.

Policy aktif:

- `Blueprint images are publicly readable` (`SELECT`): `bucket_id = 'blueprint-assets'`.
- `Organizers can upload blueprint images` (`INSERT`): bucket + organizer.
- `Organizers can update blueprint images` (`UPDATE`): bucket + organizer.
- `Organizers can delete blueprint images` (`DELETE`): bucket + organizer.

| Operasi  | `anon`                    | `tenant`                  | `organizer`                    | Catatan                                                          |
| -------- | ------------------------- | ------------------------- | ------------------------------ | ---------------------------------------------------------------- |
| `SELECT` | Diizinkan (bucket publik) | Diizinkan (bucket publik) | Diizinkan                      | URL publik tetap dapat diakses meski policy select berubah (F4). |
| `INSERT` | Ditolak (RLS)             | Ditolak (RLS)             | Diizinkan                      | Tidak ada validasi path/blueprint.                               |
| `UPDATE` | Ditolak (RLS)             | Ditolak (RLS)             | Diizinkan untuk objek mana pun | Organizer A dapat menimpa objek organizer B (F2).                |
| `DELETE` | Ditolak (RLS)             | Ditolak (RLS)             | Diizinkan untuk objek mana pun | Tidak ada pembersihan file yatim (lihat BE-05).                  |

## 4. Matriks RPC

Semua RPC di bawah adalah `SECURITY DEFINER` dengan `search_path = ''` dan
memakai nama tabel yang terqualifikasi. Sejak **BE-08**, empat RPC tulis hanya
memberi `EXECUTE` kepada `authenticated`; `PUBLIC` dan `anon` dicabut. Anon
ditolak di lapisan grant (`permission denied for function`), bukan mencapai
badan fungsi.

| RPC                          | Grant efektif           | Wajib login | Role / kepemilikan                                       | Menulis              | Hint error utama                                                                                                                          |
| ---------------------------- | ----------------------- | ----------- | -------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `create_booking(uuid,text)`  | `authenticated`         | Ya          | Semua authenticated; organizer boleh memesan event draft | `booths`, `bookings` | `SWY_AUTH_REQUIRED`, `SWY_BOOTH_NOT_FOUND`, `SWY_BOOTH_UNAVAILABLE`, `SWY_EVENT_NOT_PUBLISHED`, `SWY_ALREADY_PAID`, `SWY_BOOKING_EXPIRED` |
| `mark_booking_paid(uuid)`    | `authenticated`         | Ya          | Hanya pemilik booking                                    | `bookings`           | `SWY_AUTH_REQUIRED`, `SWY_BOOKING_NOT_FOUND`, `SWY_NOT_OWNER`, `SWY_ALREADY_PAID`, `SWY_BOOKING_EXPIRED`, `SWY_BOOKING_CANCELLED`         |
| `cancel_booking(uuid)`       | `authenticated`         | Ya          | Pemilik booking **atau** organizer                       | `bookings`, `booths` | `SWY_AUTH_REQUIRED`, `SWY_BOOKING_NOT_FOUND`, `SWY_NOT_OWNER`, `SWY_INVALID_STATE`                                                        |
| `confirm_booking(uuid)`      | `authenticated`         | Ya          | Hanya organizer                                          | `bookings`, `booths` | `SWY_AUTH_REQUIRED`, `SWY_FORBIDDEN`, `SWY_BOOKING_NOT_FOUND`, `SWY_BOOKING_EXPIRED`, `SWY_BOOKING_CANCELLED`, `SWY_INVALID_STATE`        |
| `release_expired_bookings()` | `anon`, `authenticated` | Tidak       | Tidak ada; sweep global                                  | `bookings`, `booths` | Tidak memakai hint; mengembalikan jumlah booking yang dilepas                                                                             |

Catatan:

- `SWY_AUTH_REQUIRED` muncul bila fungsi tulis dieksekusi oleh sesi
  `authenticated` tanpa `sub`. Anon sekarang tidak sampai ke badan fungsi.
- `release_expired_bookings()` sengaja diberikan ke `anon` agar halaman publik
  dapat menjalankan fallback sweep saat `pg_cron` tidak tersedia (F3).
- `current_user_role()` juga dapat dieksekusi `anon`/`authenticated` karena
  policy membutuhkannya; fungsi hanya mengembalikan role pemanggil.

## 5. Skenario negatif dan ekspektasi

| ID     | Aktor     | Aksi                                                       | Ekspektasi                                                                                                                              | Bukti otomatis                        |
| ------ | --------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| RLS-01 | Tenant    | Buka `/admin`, `/admin/bookings`, `/admin/blueprint`       | Dialihkan ke `/event`; tidak ada halaman admin dirender                                                                                 | E2E/manual (UI)                       |
| RLS-02 | Tenant    | `GET /rest/v1/blueprints?id=eq.<draft-id>`                 | `200 []`; draft tidak terlihat                                                                                                          | `rls_matrix.sql`                      |
| RLS-03 | Anon      | `PATCH /rest/v1/booths?id=eq.<booth-id>`                   | Ditolak `401/403`/`42501` atau `0` baris; status booth tidak berubah                                                                    | `rls_matrix.sql`                      |
| RLS-04 | Anon      | `POST /rest/v1/booths`                                     | Ditolak `401/403`/`42501`; tidak ada booth baru                                                                                         | `rls_matrix.sql`                      |
| RLS-05 | Tenant A  | RPC `cancel_booking(<booking-tenant-B>)`                   | Ditolak `SWY_NOT_OWNER`; booking B tetap `pending`                                                                                      | `rls_matrix.sql`                      |
| RLS-06 | Anon      | `GET /rest/v1/bookings`                                    | Ditolak atau `200 []`; tidak ada data tenant                                                                                            | `rls_matrix.sql`                      |
| RLS-07 | Tenant    | `PATCH`/`POST`/`DELETE /rest/v1/booths`                    | Update/delete `0` baris; insert `42501`; status booth tetap                                                                             | `rls_matrix.sql`                      |
| RLS-08 | Tenant    | `POST`/`PATCH`/`DELETE /rest/v1/blueprints`                | Insert `42501`; update/delete `0` baris; draft tetap ada                                                                                | `rls_matrix.sql`                      |
| RLS-09 | Tenant A  | `GET /rest/v1/bookings?id=eq.<booking-tenant-B>`           | `200 []`; hanya booking sendiri yang terlihat                                                                                           | `rls_matrix.sql`                      |
| RLS-10 | Tenant A  | RPC `confirm_booking(<booking-tenant-A>)`                  | Ditolak `SWY_FORBIDDEN`; booking tetap `pending`                                                                                        | `rls_matrix.sql`                      |
| RLS-11 | Anon      | RPC `create_booking(<booth-id>)`                           | Ditolak grant (`permission denied for function`); tidak ada booking dibuat                                                              | `rls_matrix.sql`                      |
| RLS-12 | Tenant    | Upload/update/delete objek di `blueprint-assets`           | Ditolak RLS; objek tidak berubah                                                                                                        | Manual REST/Storage                   |
| RLS-13 | Anon      | List/read objek `blueprint-assets`                         | Diizinkan; aset memang publik                                                                                                           | Manual REST/Storage                   |
| RLS-14 | Tenant    | `PUT /auth/v1/user` dengan `{"data":{"role":"organizer"}}` | **Setelah BE-07 ditolak secara efektif.** `user_metadata` boleh berubah, tetapi role tetap tenant; akses admin dan tulis tetap ditolak. | `rls_matrix.sql` (bagian 11), staging |
| RLS-15 | Organizer | `PATCH /rest/v1/bookings?id=eq.<booking-id>`               | **Setelah BE-08 ditolak di lapisan grant**; tulis hanya lewat RPC. Grant tulis dicabut dan policy organizer `SELECT` saja.              | `rls_matrix.sql`                      |

## 6. Temuan

### F1 — Role di `user_metadata` dapat dieskalasi sendiri (kritis)

**Bukti**

- `src/pages/Register.tsx` menulis `options.data: { role }` ke
  `user_metadata` saat signup.
- `src/lib/auth.ts` membaca `user.user_metadata?.role ?? user.app_metadata?.role`.
- Semua policy dan RPC membaca
  `auth.jwt() -> 'user_metadata' ->> 'role'`.
- Tidak ada `app_metadata`, tabel `profiles`, trigger `auth.users`, atau
  backfill di repo.

**Dampak**

Pengguna tenant dapat memanggil endpoint Supabase Auth untuk memperbarui
`user_metadata.role` menjadi `organizer`, lalu menyegarkan token. Setelah itu
policy organizer dan RPC organizer menganggapnya organizer:

- membaca seluruh baris `bookings` (termasuk nama, email, telepon tenant lain);
- menulis/menghapus `booths` dan `blueprints`;
- mengunggah/menghapus objek di bucket `blueprint-assets`;
- memanggil `confirm_booking` dan `cancel_booking` untuk booking tenant lain.

Tidak diperlukan service role atau akses database langsung. Ini adalah
pelanggaran otorisasi penuh dan harus diperbaiki sebelum produksi.

**Remediasi (diterapkan di BE-07)**

1. Role otorisasi dipindahkan ke `app_metadata.role` (hanya dapat ditulis
   service role/Admin API).
2. `Register.tsx` tidak lagi menulis role otorisasi. Akun baru selalu tenant;
   organizer ditunjuk admin lewat backfill/Admin API.
3. Backfill akun lama dilakukan eksplisit lewat `scripts/backfill-roles.mjs`
   dengan allowlist email/UUID, bukan menyalin `user_metadata.role`.
   `user_metadata` dipertahankan hanya untuk data tampilan seperti `full_name`.
4. Helper SQL tunggal `public.current_user_role()` membaca sumber baru dengan
   fallback `tenant`. Seluruh policy dan RPC memakai helper tersebut.
5. `src/lib/auth.ts` hanya membaca `app_metadata.role`; `Register.tsx`
   diperbarui.
6. Staging harus menguji ulang RLS-14: eskalasi lewat `user_metadata` tidak
   mengubah role efektif, organizer asli tetap dapat mengelola, dan tenant tetap
   hanya melihat booking sendiri. `supabase/tests/rls_matrix.sql` bagian 11
   mengotomatiskan skenario ini.
7. Tidak ada fallback `user_metadata` yang tersisa di policy atau RPC.

**Status:** diremediasi di BE-07 (migrasi
`20261112000000_app_metadata_role.sql`, frontend, dan skrip backfill). Verifikasi
staging masih tertunda sampai kredensial/OPS-04 tersedia. Rincian rollout dan
rollback ada di `supabase/AUTH_ROLES.md`.

### F2 — Policy Storage tidak memeriksa kepemilikan path (sedang)

Semua organizer dapat menimpa atau menghapus objek mana pun di bucket
`blueprint-assets`. Tidak ada pemeriksaan bahwa path terkait blueprint yang
sedang diedit, dan tidak ada `owner = auth.uid()`.

**Dampak:** dengan lebih dari satu organizer, satu organizer dapat merusak aset
event organizer lain. Dengan F1, tenant yang menaikkan role juga dapat
melakukannya.

**Remediasi:** tetapkan konvensi path, misalnya
`blueprint-assets/<blueprint_id>/<filename>`, lalu tambahkan syarat
`(storage.foldername(name))[1]` pada policy tulis. Alternatifnya, terima risiko
karena organizer dianggap satu tim tepercaya dan dokumentasikan. Tautkan dengan
BE-05.

**Status:** terbuka; risiko diterima sementara untuk satu organizer.

### F3 — `release_expired_bookings()` dapat dipanggil anon (rendah)

Grant `EXECUTE` diberikan ke `anon` dan `authenticated`. Fungsi hanya
membatalkan booking `pending` yang `expires_at <= now()` dan merekonsiliasi
booth, jadi tidak dapat mengubah booking yang belum kedaluwarsa.

**Dampak:** pengunjung anonim dapat memicu sweep global berulang kali. Ini
menambah beban tulis dan dapat mengubah timing pembersihan, tetapi tidak
membocorkan data dan tidak membatalkan booking aktif.

**Remediasi:** pertahankan hanya bila fallback anon benar-benar dibutuhkan;
alternatifnya batasi ke `authenticated` dan andalkan `pg_cron`/halaman tenant.
Pertimbangkan rate limit di depan RPC.

**Status:** diterima sebagai fallback; tinjau ulang saat hardening produksi.

### F4 — Bucket publik melewati policy `SELECT` untuk URL langsung (rendah)

Karena `storage.buckets.public = true`, objek dapat diambil lewat public URL
tanpa mengevaluasi policy `SELECT` pada `storage.objects`. Policy `SELECT`
terutama berlaku untuk list/akses API Storage.

**Dampak:** selama aset memang gambar publik (cover/denah), ini sesuai maksud.
Jika suatu saat gambar memuat informasi sensitif, mengganti policy saja tidak
cukup; bucket harus dijadikan privat dan memakai signed URL.

**Status:** diterima untuk aset publik; catat sebagai prasyarat bila kebutuhan
privasi berubah.

### F5 — Default privilege Supabase membuka grant tulis dan EXECUTE (diremediasi BE-08)

Project Supabase standar memberi default privilege kepada `anon` dan
`authenticated` untuk objek baru di `public`: `SELECT, INSERT, UPDATE, DELETE,
TRUNCATE` pada tabel dan `EXECUTE` pada fungsi. Sebelum BE-08, migrasi di repo
ini memberi grant eksplisit, tetapi **tidak mencabut default tersebut**. Ada
tiga efek:

**F5a — Organizer dapat menulis booking langsung.** Grant tulis default +
policy `Organizers can manage bookings FOR ALL` membuat organizer dapat
`INSERT`/`UPDATE`/`DELETE` pada `bookings` tanpa RPC. Ini melewati idempotensi,
kontrak error, pengecekan status, dan rekonsiliasi booth.

**F5b — Anon dapat mengeksekusi RPC tulis.** Grant `EXECUTE` default tetap ada
pada `create_booking`, `mark_booking_paid`, `cancel_booking`, dan
`confirm_booking`. Fungsi menolak lebih dulu karena `auth.uid()` null
(`SWY_AUTH_REQUIRED`), jadi tidak ada data berubah, tetapi kontrak "anon
ditolak di lapisan grant" tidak berlaku di project standar.

**F5c — TRUNCATE tidak dicakup RLS.** Default privilege memberi `TRUNCATE`
kepada `anon`/`authenticated`. PostgREST tidak mengekspos TRUNCATE, tetapi
grant ini tidak dapat ditutup oleh policy dan sebaiknya dicabut sebagai
defense-in-depth.

**Remediasi yang diterapkan BE-08:**

- `bookings`: seluruh grant dicabut dari `anon`; tulis/`TRUNCATE` dicabut dari
  `authenticated`; hanya `SELECT` yang tersisa. Policy organizer diubah menjadi
  `FOR SELECT`.
- `booths`/`blueprints`: grant tulis/`TRUNCATE` dicabut dari `anon`;
  `TRUNCATE` dicabut dari `authenticated`. Grant tulis `authenticated` tetap
  ada karena editor organizer menulis langsung, tetapi RLS membatasi ke
  organizer.
- Empat RPC tulis: `EXECUTE` dicabut dari `PUBLIC` dan `anon`, diberikan hanya
  ke `authenticated`.
- `release_expired_bookings()` tetap dapat dipanggil `anon` sebagai fallback
  sweep halaman publik (F3).

**Status:** diremediasi di BE-08
(`20261112000100_grant_hardening.sql`). Matriks grant, kueri verifikasi, dan
rollback ada di `supabase/GRANTS.md`. Verifikasi staging RLS-15 dan RLS-11
masih tertunda sampai OPS-04.

### F6 — Organizer dapat menulis status booth di luar state machine (rendah)

Editor denah menulis `booths` langsung, termasuk kolom `status`. Organizer
dapat menandai booth `Available` padahal masih ada booking aktif, atau
`Booked` tanpa booking `confirmed`.

**Dampak:** status sementara tidak konsisten. Unique partial index BE-02 tetap
mencegah dua booking aktif, `create_booking` memeriksa booking aktif, dan
`release_expired_bookings()` merekonsiliasi status pada sweep berikutnya.
Namun UI dapat menampilkan status yang salah sampai sweep berjalan.

**Remediasi:** batasi perubahan `status` lewat trigger/column privilege, atau
pastikan editor hanya mengubah field tata letak dan status hanya lewat RPC.
Sampai itu diterapkan, rekonsiliasi BE-02 adalah jaring pengaman.

**Status:** diterima dengan rekonsiliasi; kandidat hardening berikutnya.

## 7. Verifikasi

### 7.1 Lokal

```bash
npm run verify
```

`npm run verify` memeriksa lint, format, typecheck, unit test, build, dan
anggaran bundle. Perintah ini **tidak** menjalankan Postgres/Supabase, sehingga
tidak membuktikan RLS secara runtime.

### 7.2 Staging

Skrip `supabase/tests/rls_matrix.sql` membuat fixture uji di dalam transaksi,
mengambil peran `anon`, `tenant A`, `tenant B`, dan `organizer` lewat
`set local role` + `request.jwt.claims`, lalu rollback. Jalankan hanya di
database staging:

```bash
psql "$SUPABASE_DB_URL" \
  -v confirm_staging=yes \
  -v organizer_id='<uuid-organizer>' \
  -v tenant_a_id='<uuid-tenant-a>' \
  -v tenant_b_id='<uuid-tenant-b>' \
  -f supabase/tests/rls_matrix.sql
```

Skrip memerlukan tiga akun yang sudah ada di `auth.users`. Fixture memakai
blueprint `rls-test-draft`/`rls-test-pub`, booth dan booking dengan UUID khusus
`00000000-0000-4000-8000-00000000b*/c*`; semuanya dihapus lagi oleh `rollback`.
Skrip juga memeriksa grant minimum BE-08 dan menampilkan `NOTICE` bila sesuai,
sehingga hasilnya dapat dilampirkan ke laporan staging.

Uji manual tambahan:

1. **RLS-14 (F1):** login tenant, panggil `PUT /auth/v1/user` dengan
   `{"data":{"role":"organizer"}}`, refresh token, lalu coba baca semua booking
   dan tulis booth. Setelah BE-07, role efektif harus tetap tenant dan akses
   harus ditolak. Skenario ini juga diperiksa otomatis oleh
   `rls_matrix.sql` bagian 11.
2. **RLS-15 (F5):** sebagai organizer, `PATCH /rest/v1/bookings?id=eq.<id>`.
   Setelah BE-08 harus ditolak `401/403`/`42501` atau `0` baris; perubahan
   status hanya lewat RPC.
3. **RLS-12/13:** upload, update, dan delete objek sebagai tenant dan organizer;
   list objek sebagai anon.
4. **RLS-01:** buka route `/admin*` sebagai tenant dan pastikan redirect terjadi
   sebelum data admin dimuat.
5. **Realtime:** payload booking tenant lain tidak boleh diterima tenant
   (dilanjutkan di BE-04).

### 7.3 Kriteria lulus BE-01

- Setiap tabel/operasi di atas memiliki policy yang disengaja dan grant yang
  dipahami, termasuk default privilege Supabase.
- Skenario negatif RLS-02..RLS-11 lulus di staging.
- Tidak ada akses yang hanya bergantung pada route guard atau UI.
- F1 sudah diremediasi lewat `app_metadata.role`; verifikasi staging RLS-14
  masih wajib sebelum produksi.
- F5 sudah diremediasi lewat grant minimum BE-08; verifikasi staging RLS-15
  dan RLS-11 masih wajib sebelum produksi.

## 8. Referensi

- `supabase/migrations/20261103000000_create_booths.sql`
- `supabase/migrations/20261103000100_create_blueprints.sql`
- `supabase/migrations/20261103000200_tenant_realtime_policies.sql`
- `supabase/migrations/20261103000300_blueprint_publishing.sql`
- `supabase/migrations/20261103000400_blueprint_images.sql`
- `supabase/migrations/20261103000500_bookings.sql`
- `supabase/migrations/20261105000000_booking_expiry.sql`
- `supabase/migrations/20261111000000_rpc_idempotency_error_contract.sql`
- `supabase/migrations/20261111000100_double_booking_guarantee.sql`
- `supabase/migrations/20261112000000_app_metadata_role.sql`
- `supabase/migrations/20261112000100_grant_hardening.sql`
- `supabase/AUTH_ROLES.md`
- `supabase/GRANTS.md`
- `supabase/ERROR_CONTRACT.md`
- `supabase/DOUBLE_BOOKING.md`
- `supabase/tests/rls_matrix.sql`
- `qa_checklist_test_plan.md` (TS-13)
