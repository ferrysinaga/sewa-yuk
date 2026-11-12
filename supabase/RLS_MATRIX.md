# Matriks RLS dan Otorisasi Database

Dokumen ini adalah hasil audit **BE-01** terhadap garis pertahanan database
sewa-yuk. Cakupannya adalah tabel `public.booths`, `public.blueprints`,
`public.bookings`, bucket Storage `blueprint-assets`, dan RPC pemesanan.

Audit dilakukan dari migrasi di `supabase/migrations/` dan kode frontend yang
menulis role. Dokumen ini **tidak** mengubah skema, policy, atau RPC. Perbaikan
temuan kritis F1 membutuhkan migrasi, backfill akun, dan pengujian ulang di
staging, sehingga dicatat sebagai tindak lanjut terpisah.

## 1. Ringkasan eksekutif

- RLS aktif pada ketiga tabel publik dan `storage.objects`. Grant tabel tidak
  dapat dijadikan satu-satunya batas: project Supabase standar memberi
  `SELECT/INSERT/UPDATE/DELETE/TRUNCATE` kepada `anon` dan `authenticated`
  untuk objek baru di schema `public`, termasuk saat migrasi ini dijalankan.
  Migrasi tidak mencabut default tersebut, sehingga **RLS adalah kontrol
  utama**.
- Otorisasi role saat ini membaca
  `(auth.jwt() -> 'user_metadata' ->> 'role')`. Nilai ini **dapat diubah sendiri
  oleh pengguna** melalui Supabase Auth, sehingga belum layak menjadi sumber
  otorisasi produksi. Ini adalah temuan **F1 (kritis)**.
- Route guard dan penyembunyian tombol di frontend hanya UX. Keputusan akses
  data tetap dilakukan oleh RLS dan pengecekan di dalam RPC.
- Blueprint dan booth publik hanya terbaca bila blueprint berstatus
  `published`. Tenant dan anon tidak dapat menulis booth/blueprint/booking
  karena tidak ada policy tulis yang cocok.
- `bookings` memiliki policy organizer `FOR ALL`. Karena default privilege
  Supabase memberi grant tulis kepada `authenticated`, policy tersebut **aktif**
  dan organizer dapat menulis booking langsung tanpa RPC. Ini adalah temuan
  **F5** dan bertentangan dengan tujuan RPC-only.
- Empat RPC tulis juga mendapat grant `EXECUTE` default untuk `anon`. Migrasi
  hanya mencabut `PUBLIC`, bukan `anon`, sehingga anon dapat mencapai badan
  fungsi dan menerima `SWY_AUTH_REQUIRED` (bukan `permission denied`). Tidak
  ada data berubah karena pengecekan `auth.uid()` di awal fungsi.
- Bucket `blueprint-assets` bersifat publik. Policy tulis organizer tidak
  memeriksa kepemilikan path, sehingga setiap organizer dapat mengubah atau
  menghapus objek mana pun di bucket (F2/F4).
- `release_expired_bookings()` dapat dieksekusi `anon`. Ini disengaja sebagai
  fallback sweep, tetapi perlu ditinjau ulang (F3).

## 2. Model role dan sumber otorisasi

| Aktor          | Cara masuk                                         | Klaim yang dibaca policy/RPC                   |
| -------------- | -------------------------------------------------- | ---------------------------------------------- |
| `anon`         | Tanpa login, memakai anon key                      | Tidak punya `sub`/`user_metadata.role`         |
| `tenant`       | Login akun dengan `user_metadata.role = tenant`    | `auth.uid()` dan `user_metadata.role`          |
| `organizer`    | Login akun dengan `user_metadata.role = organizer` | `auth.uid()` dan `user_metadata.role`          |
| `service_role` | Hanya server/CI, tidak pernah di frontend          | Melewati RLS. Jangan pernah dikirim ke browser |

`src/pages/Register.tsx` menulis role saat signup:

```ts
await supabase.auth.signUp({
  email,
  password,
  options: { data: { role } },
})
```

`options.data` adalah `user_metadata`. `src/lib/auth.ts` juga memprioritaskan
`user_metadata.role` di atas `app_metadata.role`. Tidak ada tabel `profiles`,
trigger `auth.users`, atau backfill `app_metadata` di repo ini.

## 3. Matriks tabel x operasi x role

Keterangan:

- **Diizinkan** berarti policy mengizinkan dan role dapat mencapai tabel.
- **Ditolak (grant)** berarti role tidak punya privilege tabel; PostgREST
  mengembalikan `401/403` atau SQLSTATE `42501`. Ini hanya terjadi bila project
  mencabut default privilege Supabase.
- **Ditolak (RLS)** berarti grant ada (termasuk grant default Supabase), tetapi
  tidak ada policy yang cocok. `SELECT`/`UPDATE`/`DELETE` biasanya menghasilkan
  `0` baris; `INSERT` menghasilkan
  `new row violates row-level security policy` (`42501`).
- `service_role` melewati RLS dan tidak dicantumkan di setiap baris.

Default privilege Supabase untuk objek baru di `public` memberi
`SELECT, INSERT, UPDATE, DELETE, TRUNCATE` kepada `anon`/`authenticated` dan
`EXECUTE` kepada `anon`/`authenticated` untuk fungsi. Migrasi di repo ini
memberi grant eksplisit, tetapi tidak mencabut default tersebut. Karena itu,
kolom di bawah menjelaskan **efek RLS**, bukan sekadar ada/tidaknya grant
eksplisit.

### 3.1 `public.booths`

Policy aktif:

- `Booths are readable for published blueprints` (`SELECT`): blueprint induk
  `published`, **atau** role organizer.
- `Organizers can manage booths` (`ALL`, `authenticated`): role organizer.

| Operasi  | `anon`                          | `tenant`                        | `organizer` | Catatan                                                                 |
| -------- | ------------------------------- | ------------------------------- | ----------- | ----------------------------------------------------------------------- |
| `SELECT` | Hanya booth blueprint published | Hanya booth blueprint published | Semua booth | Policy publik tidak membocorkan booth draft.                            |
| `INSERT` | Ditolak (RLS)                   | Ditolak (RLS)                   | Diizinkan   | Grant default ada, tetapi tidak ada policy insert untuk anon/tenant.    |
| `UPDATE` | Ditolak (RLS, 0 baris)          | Ditolak (RLS, 0 baris)          | Diizinkan   | Policy reservasi tenant sudah di-drop di migrasi bookings.              |
| `DELETE` | Ditolak (RLS, 0 baris)          | Ditolak (RLS, 0 baris)          | Diizinkan   | Hapus booth membuat `bookings.booth_id` menjadi `null` (riwayat tetap). |

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
| `INSERT` | Ditolak (RLS)               | Ditolak (RLS)               | Diizinkan   | Grant default ada, tetapi tidak ada policy insert.      |
| `UPDATE` | Ditolak (RLS, 0 baris)      | Ditolak (RLS, 0 baris)      | Diizinkan   | Tenant tidak bisa publish draft.                        |
| `DELETE` | Ditolak (RLS, 0 baris)      | Ditolak (RLS, 0 baris)      | Diizinkan   | Hapus blueprint tidak menghapus booth/booking otomatis. |

Policy lama `Blueprints are publicly readable` sudah di-drop. Hanya policy
publikasi yang berlaku.

### 3.3 `public.bookings`

Policy aktif:

- `Tenants can view own bookings` (`SELECT`, `authenticated`):
  `user_id = auth.uid()`.
- `Organizers can manage bookings` (`ALL`, `authenticated`): role organizer.
- Grant tabel eksplisit: `SELECT` untuk `authenticated`. Namun default
  privilege Supabase memberi `SELECT/INSERT/UPDATE/DELETE/TRUNCATE` kepada
  `anon` dan `authenticated`; migrasi tidak mencabutnya.

| Operasi  | `anon`           | `tenant`                    | `organizer`            | Catatan                                                                 |
| -------- | ---------------- | --------------------------- | ---------------------- | ----------------------------------------------------------------------- |
| `SELECT` | Ditolak (RLS, 0) | Hanya booking milik sendiri | Semua booking          | Anon punya grant default, tetapi tidak ada policy select.               |
| `INSERT` | Ditolak (RLS)    | Ditolak (RLS)               | **Diizinkan langsung** | Policy organizer `FOR ALL` + grant default (F5). RPC tetap jalur resmi. |
| `UPDATE` | Ditolak (RLS, 0) | Ditolak (RLS, 0)            | **Diizinkan langsung** | Organizer dapat melewati idempotensi/kontrak error RPC (F5).            |
| `DELETE` | Ditolak (RLS, 0) | Ditolak (RLS, 0)            | **Diizinkan langsung** | Tidak ada alur hapus resmi; gunakan `cancel_booking`.                   |

Catatan penting:

- Policy organizer `FOR ALL` **bukan dead code** di project Supabase standar:
  default privilege memberi grant tulis, sehingga organizer dapat menulis
  booking langsung. Ini melewati RPC dan audit. Perbaikan yang disarankan:
  `revoke insert, update, delete, truncate on public.bookings from anon,
authenticated;` lalu grant `SELECT` saja (F5).
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
memakai nama tabel yang terqualifikasi. Migrasi mencabut grant `PUBLIC` dan
memberi grant eksplisit, tetapi default privilege Supabase tetap memberi
`EXECUTE` kepada `anon` dan `authenticated`. Fungsi tulis tetap aman karena
memeriksa `auth.uid()` di awal, namun anon mencapai badan fungsi dan menerima
`SWY_AUTH_REQUIRED`, bukan `permission denied`.

| RPC                          | Grant efektif            | Wajib login | Role / kepemilikan                                       | Menulis              | Hint error utama                                                                                                                          |
| ---------------------------- | ------------------------ | ----------- | -------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `create_booking(uuid,text)`  | `anon`*, `authenticated` | Ya          | Semua authenticated; organizer boleh memesan event draft | `booths`, `bookings` | `SWY_AUTH_REQUIRED`, `SWY_BOOTH_NOT_FOUND`, `SWY_BOOTH_UNAVAILABLE`, `SWY_EVENT_NOT_PUBLISHED`, `SWY_ALREADY_PAID`, `SWY_BOOKING_EXPIRED` |
| `mark_booking_paid(uuid)`    | `anon`*, `authenticated` | Ya          | Hanya pemilik booking                                    | `bookings`           | `SWY_AUTH_REQUIRED`, `SWY_BOOKING_NOT_FOUND`, `SWY_NOT_OWNER`, `SWY_ALREADY_PAID`, `SWY_BOOKING_EXPIRED`, `SWY_BOOKING_CANCELLED`         |
| `cancel_booking(uuid)`       | `anon`*, `authenticated` | Ya          | Pemilik booking **atau** organizer                       | `bookings`, `booths` | `SWY_AUTH_REQUIRED`, `SWY_BOOKING_NOT_FOUND`, `SWY_NOT_OWNER`, `SWY_INVALID_STATE`                                                        |
| `confirm_booking(uuid)`      | `anon`*, `authenticated` | Ya          | Hanya organizer                                          | `bookings`, `booths` | `SWY_AUTH_REQUIRED`, `SWY_FORBIDDEN`, `SWY_BOOKING_NOT_FOUND`, `SWY_BOOKING_EXPIRED`, `SWY_BOOKING_CANCELLED`, `SWY_INVALID_STATE`        |
| `release_expired_bookings()` | `anon`, `authenticated`  | Tidak       | Tidak ada; sweep global                                  | `bookings`, `booths` | Tidak memakai hint; mengembalikan jumlah booking yang dilepas                                                                             |

\* Grant `anon` berasal dari default privilege Supabase. Bila project sudah
mencabut default privilege dan hanya memberi grant ke `authenticated`,
pemanggilan anon ditolak `permission denied for function`.

Catatan:

- `SWY_AUTH_REQUIRED` muncul bila fungsi dieksekusi tanpa `sub`, termasuk anon
  pada project dengan default privilege. Ini bukan izin tulis; pengecekan
  dilakukan sebelum operasi apa pun.
- `release_expired_bookings()` sengaja diberikan ke `anon` agar halaman publik
  dapat menjalankan fallback sweep saat `pg_cron` tidak tersedia (F3).

## 5. Skenario negatif dan ekspektasi

| ID     | Aktor     | Aksi                                                       | Ekspektasi                                                                                                      | Bukti otomatis      |
| ------ | --------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------- |
| RLS-01 | Tenant    | Buka `/admin`, `/admin/bookings`, `/admin/blueprint`       | Dialihkan ke `/event`; tidak ada halaman admin dirender                                                         | E2E/manual (UI)     |
| RLS-02 | Tenant    | `GET /rest/v1/blueprints?id=eq.<draft-id>`                 | `200 []`; draft tidak terlihat                                                                                  | `rls_matrix.sql`    |
| RLS-03 | Anon      | `PATCH /rest/v1/booths?id=eq.<booth-id>`                   | Ditolak `401/403`/`42501` atau `0` baris; status booth tidak berubah                                            | `rls_matrix.sql`    |
| RLS-04 | Anon      | `POST /rest/v1/booths`                                     | Ditolak `401/403`/`42501`; tidak ada booth baru                                                                 | `rls_matrix.sql`    |
| RLS-05 | Tenant A  | RPC `cancel_booking(<booking-tenant-B>)`                   | Ditolak `SWY_NOT_OWNER`; booking B tetap `pending`                                                              | `rls_matrix.sql`    |
| RLS-06 | Anon      | `GET /rest/v1/bookings`                                    | Ditolak atau `200 []`; tidak ada data tenant                                                                    | `rls_matrix.sql`    |
| RLS-07 | Tenant    | `PATCH`/`POST`/`DELETE /rest/v1/booths`                    | Update/delete `0` baris; insert `42501`; status booth tetap                                                     | `rls_matrix.sql`    |
| RLS-08 | Tenant    | `POST`/`PATCH`/`DELETE /rest/v1/blueprints`                | Insert `42501`; update/delete `0` baris; draft tetap ada                                                        | `rls_matrix.sql`    |
| RLS-09 | Tenant A  | `GET /rest/v1/bookings?id=eq.<booking-tenant-B>`           | `200 []`; hanya booking sendiri yang terlihat                                                                   | `rls_matrix.sql`    |
| RLS-10 | Tenant A  | RPC `confirm_booking(<booking-tenant-A>)`                  | Ditolak `SWY_FORBIDDEN`; booking tetap `pending`                                                                | `rls_matrix.sql`    |
| RLS-11 | Anon      | RPC `create_booking(<booth-id>)`                           | Ditolak grant **atau** `SWY_AUTH_REQUIRED`; tidak ada booking dibuat                                            | `rls_matrix.sql`    |
| RLS-12 | Tenant    | Upload/update/delete objek di `blueprint-assets`           | Ditolak RLS; objek tidak berubah                                                                                | Manual REST/Storage |
| RLS-13 | Anon      | List/read objek `blueprint-assets`                         | Diizinkan; aset memang publik                                                                                   | Manual REST/Storage |
| RLS-14 | Tenant    | `PUT /auth/v1/user` dengan `{"data":{"role":"organizer"}}` | **Saat ini berhasil (F1).** Setelah remediasi, role efektif tetap tenant                                        | Manual, staging     |
| RLS-15 | Organizer | `PATCH /rest/v1/bookings?id=eq.<booking-id>`               | **Saat ini berhasil (F5)** karena policy `FOR ALL` + grant default. Target: ditolak setelah grant tulis dicabut | `rls_matrix.sql`    |

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

**Remediasi yang disarankan**

1. Pindahkan role otorisasi ke `app_metadata.role` (hanya dapat ditulis
   service role/admin API) atau tabel `public.user_roles` dengan RLS baca
   sendiri dan tulis hanya lewat service role.
2. Jangan lagi menulis role otorisasi dari `Register.tsx`. Untuk pendaftaran
   organizer, gunakan Edge Function/server yang memvalidasi undangan atau
   persetujuan admin, lalu menulis `app_metadata` dengan admin API. Jika
   self-signup organizer tidak diperlukan, default-kan akun baru ke `tenant`.
3. Backfill akun yang sudah ada dari `user_metadata.role` ke sumber baru.
   Pertahankan `user_metadata` hanya untuk data tampilan seperti `full_name`.
4. Buat helper SQL tunggal, misalnya `public.current_role()`, yang membaca
   sumber baru. Ganti seluruh policy dan RPC agar memakai helper tersebut.
5. Ubah `src/lib/auth.ts` agar memprioritaskan `app_metadata.role`, lalu
   perbarui `Register.tsx`.
6. Uji ulang di staging: RLS-14 harus gagal menaikkan role; organizer asli
   tetap dapat mengelola; tenant tetap hanya melihat booking sendiri.
7. Setelah backfill terverifikasi, hapus fallback `user_metadata` dari policy
   dan RPC.

**Status:** terbuka. Tidak diubah di BE-01 karena melibatkan migrasi, backfill,
perubahan alur signup, dan pengujian ulang staging.

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

### F5 — Default privilege Supabase membuka grant tulis dan EXECUTE (sedang)

Project Supabase standar memberi default privilege kepada `anon` dan
`authenticated` untuk objek baru di `public`: `SELECT, INSERT, UPDATE, DELETE,
TRUNCATE` pada tabel dan `EXECUTE` pada fungsi. Migrasi di repo ini memberi
grant eksplisit, tetapi **tidak mencabut default tersebut**. Ada tiga efek:

**F5a — Organizer dapat menulis booking langsung.** Grant tulis default +
policy `Organizers can manage bookings FOR ALL` membuat organizer dapat
`INSERT`/`UPDATE`/`DELETE` pada `bookings` tanpa RPC. Ini melewati idempotensi,
kontrak error, pengecekan status, dan rekonsiliasi booth. Contoh: mengubah
booking menjadi `confirmed` tanpa mengisi `paid_at` atau tanpa mengubah booth
menjadi `Booked`.

**F5b — Anon dapat mengeksekusi RPC tulis.** Grant `EXECUTE` default tetap ada
pada `create_booking`, `mark_booking_paid`, `cancel_booking`, dan
`confirm_booking`. Fungsi menolak lebih dulu karena `auth.uid()` null
(`SWY_AUTH_REQUIRED`), jadi tidak ada data berubah, tetapi kontrak "anon
ditolak di lapisan grant" tidak berlaku di project standar.

**F5c — TRUNCATE tidak dicakup RLS.** Default privilege memberi `TRUNCATE`
kepada `anon`/`authenticated`. PostgREST tidak mengekspos TRUNCATE, tetapi
grant ini tidak dapat ditutup oleh policy dan sebaiknya dicabut sebagai
defense-in-depth.

**Dampak:** organizer (dan, karena F1, tenant yang menaikkan role) dapat
mengubah data booking di luar state machine. Anon tidak dapat menulis karena
pengecekan RPC, tetapi permukaan serangan lebih besar dari yang terdokumentasi.

**Remediasi yang disarankan (staging-only):**

```sql
revoke insert, update, delete, truncate on public.bookings
  from anon, authenticated;

revoke execute on function public.create_booking(uuid, text)
  from anon;
revoke execute on function public.mark_booking_paid(uuid)
  from anon;
revoke execute on function public.cancel_booking(uuid)
  from anon;
revoke execute on function public.confirm_booking(uuid)
  from anon;

grant select on public.bookings to authenticated;
grant execute on function public.create_booking(uuid, text) to authenticated;
grant execute on function public.mark_booking_paid(uuid) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;
grant execute on function public.confirm_booking(uuid) to authenticated;
grant execute on function public.release_expired_bookings() to anon, authenticated;
```

Pertimbangkan juga mencabut grant tulis `anon` pada `booths`/`blueprints`
(tenant sudah ditolak RLS) dan memisahkan policy organizer `bookings` menjadi
`FOR SELECT` saja. Uji ulang `rls_matrix.sql` dan RLS-15 di staging.

**Status:** terbuka; kandidat task BE-08. Tidak diubah di BE-01 karena
mengubah grant dan perlu pengujian ulang staging.

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
Skrip juga menampilkan `NOTICE`/`WARNING` tentang grant default Supabase dan
status F5, sehingga hasilnya dapat dilampirkan ke laporan staging.

Uji manual tambahan:

1. **RLS-14 (F1):** login tenant, panggil `PUT /auth/v1/user` dengan
   `{"data":{"role":"organizer"}}`, refresh token, lalu coba baca semua booking.
   Saat ini harus berhasil (membuktikan F1); setelah remediasi harus gagal.
2. **RLS-15 (F5):** sebagai organizer, `PATCH /rest/v1/bookings?id=eq.<id>`.
   Di project dengan default privilege, saat ini berhasil; setelah grant tulis
   dicabut harus ditolak.
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
- F1 tercatat sebagai blocker produksi dengan rencana remediasi yang dapat
  diuji ulang.
- F5 tercatat sebagai hardening grant; target RLS-15 adalah penolakan setelah
  grant tulis booking dicabut.

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
- `supabase/ERROR_CONTRACT.md`
- `supabase/DOUBLE_BOOKING.md`
- `supabase/tests/rls_matrix.sql`
- `qa_checklist_test_plan.md` (TS-13)
