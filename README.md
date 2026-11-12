# sewa-yuk

Aplikasi web untuk menyewa booth pameran: penyelenggara menyusun denah lewat
editor drag-and-drop, penyewa memilih booth dari kanvas interaktif, lalu
memesan dan membayar. Status booth tersinkron antar tab lewat Supabase
Realtime.

Dokumen ini ditujukan untuk tester yang baru bergabung: ikuti urutannya dari
atas agar aplikasi, database, akun uji, dan tes otomatis siap dipakai.

## 1. Stack

- Vite 8 + React 19 + TypeScript
- Tailwind CSS (token warna dan pedoman desain di `frontend.md`)
- Zustand untuk state denah (`src/store/useBoothStore.ts`)
- `@dnd-kit/core` untuk drag-and-drop booth
- Supabase (Postgres, Auth, Storage, Realtime)
- Vitest + Testing Library untuk unit test
- Playwright + `@axe-core/playwright` untuk E2E dan audit aksesibilitas
- ESLint + Prettier untuk lint dan format kode

## 2. Prasyarat

- Node.js 22.22+ atau 24.15+ (disarankan LTS terbaru). Beberapa dependensi
  pengujian belum mendukung Node 20.
- npm 10+
- Proyek Supabase (cloud atau lokal)
- Browser Chromium untuk Playwright

Di Windows PowerShell, jika `npm` diblokir execution policy, gunakan
`npm.cmd` untuk semua perintah di bawah.

## 3. Instalasi

```bash
npm install
npx playwright install chromium
```

## 4. Environment aplikasi

Buat file `.env` di root proyek (file ini tidak di-commit):

```dotenv
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-public-key>
```

Ambil kedua nilai dari **Supabase Dashboard → Project Settings → API**.

Catatan keamanan:

- Hanya `VITE_*` yang dikirim ke browser. Jangan pernah menaruh
  `service_role` key di `.env` frontend.
- `anon public key` aman dipakai selama Row Level Security (RLS) aktif.
- Jika `.env` kosong, aplikasi tetap terbuka tetapi menampilkan peringatan
  "Supabase belum dikonfigurasi" dan data tidak dapat dimuat.

## 5. Setup Supabase

### 5.1 Jalankan migrasi sesuai urutan

Buka **Supabase Dashboard → SQL Editor**, lalu jalankan file berikut satu per
satu. Urutan ini penting karena saling bergantung.

| Urutan | File                                                                    | Isi                                                                |
| ------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1      | `supabase/migrations/20261103000000_create_booths.sql`                  | Tabel `booths`, index, RLS dasar                                   |
| 2      | `supabase/migrations/20261103000100_create_blueprints.sql`              | Tabel `blueprints` + 3 event contoh (`hall-a`, `hall-b`, `hall-5`) |
| 3      | `supabase/migrations/20261103000200_tenant_realtime_policies.sql`       | Policy reservasi tenant + aktifkan Realtime `booths`               |
| 4      | `supabase/migrations/20261103000300_blueprint_publishing.sql`           | Kolom `status`, aturan publish/draft, RLS baca booth               |
| 5      | `supabase/migrations/20261103000400_blueprint_images.sql`               | Kolom gambar denah + bucket Storage `blueprint-assets`             |
| 6      | `supabase/migrations/20261103000500_bookings.sql`                       | Tabel `bookings`, RPC pemesanan, Realtime `bookings`               |
| 7      | `supabase/migrations/20261105000000_booking_expiry.sql`                 | Auto-release booking kedaluwarsa + `cancelled_reason`              |
| 8      | `supabase/migrations/20261111000000_rpc_idempotency_error_contract.sql` | Idempotensi RPC, kontrak error, dan `search_path` aman             |
| 9      | `supabase/migrations/20261111000100_double_booking_guarantee.sql`       | Unique index anti double booking + rekonsiliasi booth              |

Semua migrasi ditulis idempoten, jadi aman dijalankan ulang bila eksekusi
sebelumnya terputus. Bila memakai Supabase CLI dengan konfigurasi lokal,
letakkan file di `supabase/migrations/` dan jalankan `supabase db push`
(atau `supabase db reset` untuk database lokal).

Kontrak error RPC pemesanan dan matriks idempotensi ada di
`supabase/ERROR_CONTRACT.md`. Frontend memetakan `hint` error ke pesan pengguna
lewat `getBookingErrorMessage` di `src/lib/booking.ts`.

Jaminan satu booking aktif per booth, preflight duplikat, dan rekonsiliasi
status booth ada di `supabase/DOUBLE_BOOKING.md`.

Matriks RLS per tabel/operasi/role, skenario negatif, dan temuan audit ada di
`supabase/RLS_MATRIX.md`. Uji RLS staging dijalankan dengan
`supabase/tests/rls_matrix.sql` memakai akun organizer, tenant A, tenant B, dan
anon. Temuan kritis F1 (role di `user_metadata` dapat diubah sendiri) harus
diperbaiki sebelum produksi; lihat dokumen tersebut untuk rencana remediasi.

Project Supabase standar memberi grant default `SELECT/INSERT/UPDATE/DELETE/
TRUNCATE` dan `EXECUTE` kepada `anon`/`authenticated` untuk objek baru di
schema `public`. Migrasi tidak mencabut default tersebut, jadi RLS adalah
kontrol utama. Temuan F5 dan rekomendasi pencabutan grant ada di
`supabase/RLS_MATRIX.md`.

Konfigurasi publication Realtime, channel/filter frontend, dan jaminan privasi
payload booking ada di `supabase/REALTIME_PRIVACY.md`. Tenant hanya menerima
booking miliknya dan booth pada blueprint `published`; filter channel bukan
batas keamanan, RLS tetap yang menentukan.

### 5.2 Data seed (opsional)

Tiga blueprint contoh sudah dibuat oleh migrasi. Untuk menambahkan enam booth
contoh pada `hall-a`:

```bash
# Supabase Dashboard → SQL Editor, jalankan isi file:
supabase/seed.sql
```

Seed memakai UUID tetap sehingga aman dijalankan berulang. Tanpa seed, buat
booth manual lewat `/admin/blueprint/hall-a`.

### 5.3 Realtime

Migrasi sudah menambahkan tabel `booths` dan `bookings` ke publication
`supabase_realtime`. Verifikasi di **Database → Replication** bahwa kedua
tabel berstatus aktif. Realtime dibutuhkan untuk:

- booth baru/terhapus/berubah langsung tampil di kanvas tenant lain;
- status booking dan booth tersinkron antara halaman tenant dan organizer.

### 5.4 Storage

Migrasi gambar membuat bucket publik `blueprint-assets` (maks. 5 MB, tipe
`image/png`, `image/jpeg`, `image/webp`). Upload dan hapus gambar hanya boleh
dilakukan akun dengan role `organizer`.

Validasi klien/server, sumber file yatim, dan prosedur pembersihan ada di
`supabase/STORAGE.md`. Audit katalog (read-only, staging) dijalankan dengan
`supabase/tests/storage_audit.sql`. Pembersihan file tanpa referensi memakai
Storage API lewat `npm run storage:orphans -- --older-than-hours=24` (dry-run)
dan `-- --delete` setelah daftar ditinjau. Skrip memerlukan
`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` dan menolak kunci non-service-role.

### 5.5 pg_cron (opsional)

Migrasi expiry mencoba mendaftarkan job `pg_cron` setiap 2 menit. Jika ekstensi
tidak tersedia, aplikasi tetap aman: halaman `/event`, `/event/:id`,
`/bookings`, dan `/admin/bookings` memanggil RPC `release_expired_bookings()`
saat dibuka, dan tombol **Perbarui status** menjalankan sweep yang sama.

## 6. Akun uji dan role

Role disimpan di `user_metadata.role` saat pendaftaran:

- **Penyelenggara / organizer** → akses `/admin*`
- **Penyewa / tenant** → akses `/event*` dan `/bookings`

> **Peringatan keamanan (BE-01 F1):** `user_metadata` dapat diubah sendiri oleh
> pengguna melalui Supabase Auth. Sampai remediasi F1 diterapkan, role di
> `user_metadata` belum layak dipercaya untuk produksi. Jangan menambah fitur
> sensitif yang hanya bergantung pada nilai ini. Rencana perbaikan ada di
> `supabase/RLS_MATRIX.md`.

Cara membuat akun:

1. Buka `/register`.
2. Pilih peran yang sesuai.
3. Daftar dengan email aktif. Jika konfirmasi email aktif di Supabase, klik
   tautan konfirmasi sebelum login.
4. Ulangi untuk akun kedua dan seterusnya.

Akun minimum untuk QA lengkap:

| Akun      | Role        | Kegunaan                                    |
| --------- | ----------- | ------------------------------------------- |
| Organizer | `organizer` | Dashboard, kelola denah, verifikasi booking |
| Tenant A  | `tenant`    | Membuat booking, uji realtime               |
| Tenant B  | `tenant`    | Tab kedua untuk uji realtime/race condition |

Jika role akun salah, perbaiki lewat **Authentication → Users → Edit user**
(`raw_user_meta_data`) atau SQL berikut, lalu logout/login agar JWT diperbarui:

```sql
update auth.users
set raw_user_meta_data = raw_user_meta_data || '{"role":"organizer"}'::jsonb
where email = 'organizer@example.com';
```

Ganti `organizer` dengan `tenant` sesuai kebutuhan. Jangan mengubah role lewat
tabel `public` karena otorisasi RLS membaca JWT.

## 7. Menjalankan aplikasi

```bash
npm run dev
```

Buka `http://localhost:5173`. Untuk E2E, Playwright memakai
`http://127.0.0.1:5173` dan dapat menjalankan dev server otomatis.

Build produksi dan pratinjau:

```bash
npm run build
npm run preview
```

## 8. Daftar route aktual

| Route                           | Akses     | Halaman                                 |
| ------------------------------- | --------- | --------------------------------------- |
| `/`                             | Publik    | Landing page + demo denah               |
| `/login`                        | Publik    | Masuk                                   |
| `/register`                     | Publik    | Daftar akun tenant/organizer            |
| `/event`                        | Publik    | Jelajah event yang sudah dipublikasikan |
| `/event/:eventId`               | Publik    | Kanvas booth + checkout                 |
| `/bookings`                     | Tenant    | Daftar pesanan milik sendiri            |
| `/admin`                        | Organizer | Dashboard okupansi dan status booth     |
| `/admin/bookings`               | Organizer | Verifikasi / batalkan booking           |
| `/admin/blueprint`              | Organizer | Daftar dan publikasi denah              |
| `/admin/blueprint/:blueprintId` | Organizer | Editor denah drag-and-drop              |
| `/admin/*`                      | Organizer | Dialihkan ke `/admin`                   |
| `*`                             | Publik    | Dialihkan ke `/`                        |

Aturan redirect:

- Belum login membuka route terproteksi → `/login`, lalu kembali ke URL awal.
- Tenant membuka route organizer → `/event`.
- Organizer membuka route tenant → `/admin` sesuai `getDefaultRouteForRole`.

## 9. Menjalankan tes

### Verifikasi lokal

Sebelum push, jalankan seluruh gerbang wajib dalam satu perintah:

```bash
npm run verify
```

Perintah ini menjalankan lint, cek format, `npm run typecheck`
(`tsc --noEmit`), unit test, lalu build produksi. Arti kegagalannya:

| Langkah                | Jika gagal                                                           |
| ---------------------- | -------------------------------------------------------------------- |
| `npm run lint`         | Ada pelanggaran ESLint; jalankan `npm run lint:fix` lalu tinjau diff |
| `npm run format:check` | Ada file belum sesuai Prettier; jalankan `npm run format`            |
| `npm run typecheck`    | Ada error tipe TypeScript; perbaiki sebelum build                    |
| `npm test`             | Ada unit test gagal atau perilaku yang berubah                       |
| `npm run build`        | Bundle produksi gagal dibuat, biasanya karena error tipe atau import |

Lint dan format juga bisa dijalankan terpisah dengan `npm run lint` dan
`npm run format`. Prettier memakai pengaturan di `.prettierrc`; file yang
dikecualikan ada di `.prettierignore`.

Catatan tooling: `typescript` di-_alias_ ke `@typescript/typescript6` agar
typescript-eslint tetap mendapat API TypeScript 6, sementara `tsc` untuk
typecheck dan build memakai TypeScript 7 lewat paket `typescript7`
(`node ./node_modules/typescript7/bin/tsc`). Ini mengikuti anjuran resmi
TypeScript untuk menjalankan versi 6 dan 7 berdampingan.

Cakupan kode diperiksa terpisah dengan `npm run test:coverage`. Ambang batas
ada di `vite.config.ts` dan berlaku untuk `src/lib` + `src/store`; bila turun
di bawah ambang, perintah keluar dengan status gagal.

### Unit test

```bash
npm test
npm run test:watch
npm run test:coverage
```

Cakupan unit test saat ini: **128 test di 18 file** yang mencakup store booth
(termasuk aksi realtime), panel status, dialog konfirmasi inline, toast,
modal checkout, route terproteksi, hook booking (realtime, hitungan
kedaluwarsa, sweep, debounce), judul dokumen per halaman, ekstraksi pesan
error, helper kanvas, util booking, util blueprint, mapper row booth, dan
indikator status realtime. Tes tidak memerlukan kredensial Supabase.

### CI GitHub Actions

Workflow `.github/workflows/ci.yml` berjalan pada setiap push dan pull request:
Node 22 dengan cache npm, `npm ci`, `npm run lint`, `npm run format:check`,
`npm run typecheck`, `npm run test:coverage`, `npm run build`, lalu smoke test
Playwright (`e2e/smoke.spec.ts`). Smoke test tidak membutuhkan kredensial; tes
E2E berautentikasi tetap dilewati.

Bila workflow merah, buka langkah yang gagal di tab **Actions**:

- **Lint** — pelanggaran ESLint; jalankan `npm run lint` lokal.
- **Format check** — file belum diformat; jalankan `npm run format` lokal.
- **Typecheck** — error tipe; jalankan `npm run typecheck` lokal.
- **Unit test with coverage** — test gagal atau cakupan turun; jalankan
  `npm run test:coverage` lokal.
- **Build production bundle** — jalankan `npm run build` lokal.
- **E2E smoke** — halaman login gagal dimuat; jalankan
  `npx playwright test e2e/smoke.spec.ts` lokal.

### E2E dan aksesibilitas

```bash
npm run test:e2e
npm run test:e2e -- e2e/a11y.spec.ts
```

Tanpa kredensial, yang berjalan hanya:

- `e2e/smoke.spec.ts` — halaman login dapat dimuat;
- `e2e/a11y.spec.ts` — audit axe WCAG A/AA untuk Landing dan `/event`.

Tes realtime `e2e/sync.spec.ts` dan audit halaman terautentikasi otomatis
**dilewati** dengan pesan alasan bila `.env.e2e` belum diisi.

### Konfigurasi `.env.e2e`

Salin `.env.e2e.example` menjadi `.env.e2e`, lalu isi:

```dotenv
E2E_BASE_URL=http://127.0.0.1:5173

E2E_TENANT_A_EMAIL=
E2E_TENANT_A_PASSWORD=
E2E_TENANT_B_EMAIL=
E2E_TENANT_B_PASSWORD=

E2E_ORGANIZER_EMAIL=
E2E_ORGANIZER_PASSWORD=

E2E_EVENT_ID=hall-a
E2E_BOOTH_ID=11111111-1111-4111-8111-111111111101
```

Prasyarat data:

- `hall-a` berstatus `published` dan memiliki minimal satu booth `Available`;
- `E2E_BOOTH_ID` menunjuk booth `Available` yang boleh dipakai bergantian;
- akun organizer dan tenant sudah dikonfirmasi;
- Realtime aktif untuk `booths` dan `bookings`.

Tes SYNC memakai dua browser context dan mengembalikan booth ke `Available`
lewat pembatalan booking di akhir skenario. Jangan arahkan `E2E_BOOTH_ID` ke
booth produksi.

Audit aksesibilitas mencakup:

| Tes     | Route             | Syarat                      |
| ------- | ----------------- | --------------------------- |
| A11Y-01 | `/`               | selalu jalan                |
| A11Y-02 | `/event`          | selalu jalan                |
| A11Y-03 | `/event/:eventId` | `E2E_EVENT_ID` terisi       |
| A11Y-04 | `/admin`          | kredensial organizer terisi |
| A11Y-05 | `/admin/bookings` | kredensial organizer terisi |
| A11Y-06 | `/bookings`       | kredensial tenant A terisi  |

## 10. Alur QA singkat

1. Login organizer → buka `/admin/blueprint/hall-a` → tambah/geser booth →
   ubah status lewat panel properti → **Simpan Perubahan Denah**. Dari
   `/admin/blueprint`, gunakan **Edit Detail** untuk nama/venue/tanggal atau
   **Hapus** (konfirmasi inline) bila tidak ada booking aktif.
2. Buka `/event/hall-a` di dua tab tenant berbeda. Tambah/hapus booth di
   editor organizer; kanvas kedua tab harus berubah tanpa reload.
3. Dari tab tenant, pilih booth → **Pesan booth ini** → buat pesanan. Booth
   berubah menjadi `Reserved` di tab lain.
4. Di `/bookings`, tandai sudah bayar. Di `/admin/bookings`, verifikasi
   (booth menjadi `Booked`) atau batalkan lewat konfirmasi inline.
5. Biarkan booking `pending` melewati `expires_at`, lalu klik
   **Perbarui status**. Booking menjadi `Kedaluwarsa` dan booth kembali
   `Available`.
6. Uji keyboard: Tab ke booth, Enter/Space untuk memilih, Escape untuk
   melepas pilihan. Tombol batal booking memakai `role="alertdialog"` dan
   dapat ditutup dengan Escape.
7. Jalankan `npm run test:e2e -- e2e/a11y.spec.ts` untuk memastikan tidak ada
   pelanggaran WCAG A/AA pada halaman yang dapat diaudit.

## 11. Troubleshooting

| Gejala                                           | Penyebab umum              | Solusi                                                                      |
| ------------------------------------------------ | -------------------------- | --------------------------------------------------------------------------- |
| "Supabase belum dikonfigurasi"                   | `.env` belum ada / kosong  | Isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`, restart `npm run dev` |
| "Tabel ... belum tersedia"                       | Migrasi belum dijalankan   | Jalankan migrasi sesuai urutan bagian 5.1                                   |
| Login berhasil tetapi diarahkan ke halaman salah | `user_metadata.role` salah | Perbaiki role, logout, login ulang                                          |
| Tenant tidak bisa membuka `/admin`               | Memang dibatasi            | Gunakan akun organizer                                                      |
| Booth tidak muncul di `/event`                   | Blueprint masih `draft`    | Publikasikan lewat `/admin/blueprint`                                       |
| Denah tidak bisa dihapus                         | Masih ada booking aktif    | Selesaikan atau batalkan booking terkait di `/admin/bookings`               |
| Perubahan booth tidak realtime                   | Realtime belum aktif       | Aktifkan `booths` dan `bookings` di Database → Replication                  |
| E2E SYNC dilewati                                | `.env.e2e` belum lengkap   | Isi semua variabel dan sediakan booth `Available`                           |
| `npm` ditolak di PowerShell                      | Execution policy           | Gunakan `npm.cmd`                                                           |

## 12. Catatan pengembangan

- Jangan mengubah routing, logika Supabase, logika Zustand, atau DnD yang
  sudah berjalan tanpa alasan kuat.
- Ikuti `frontend.md`: token warna warm, radius 6–10px, border tipis, tanpa
  gradient/blur/shadow tebal/emoji.
- Skala desain ada di `src/style.css` dan dipetakan di `tailwind.config.ts`.
  Gunakan `rounded-micro/chip/control/card-sm/card` (2/4/6/8/10 px),
  `text-micro/tiny/compact/body-lg/display-sm/display`, serta
  `text-on-accent`/`fill-on-accent` untuk foreground di atas pine, clay, atau
  danger. Jangan menambah `rounded-[...]`, `text-[...px]`, `bg-white`,
  `text-white`, atau hex mentah di komponen; detail inventaris dan pengecualian
  yang disengaja ada di `docs/product/UX-04-design-token-audit.md`. Jangan pula
  memakai opacity modifier (`/40`) pada warna token karena Tailwind 3 tidak
  menghasilkannya untuk warna `var(...)`; tambahkan token alpha eksplisit
  seperti `on-accent-soft` atau `ink-overlay`.
- Route sudah di-lazy-load per halaman. `vite.config.ts` juga memisahkan
  vendor React, React Router, Supabase, dan `@dnd-kit` lewat
  `build.rollupOptions.output.codeSplitting` (API rolldown di Vite 8), sehingga
  tidak ada chunk yang melewati ambang peringatan 500 kB dan cache vendor
  tetap stabil antar-rilis. Jika menambah dependensi besar, pantau kembali
  ukuran chunk saat build.
- Budget bundle dijaga oleh `scripts/check-bundle-budget.mjs`. Pemeriksaan
  berjalan otomatis di akhir `npm run verify`, atau manual dengan
  `npm run check:bundle` setelah build. Baseline 11 November 2026: 32 chunk JS,
  total 789,63 kB, CSS 28,51 kB; chunk terbesar `react` 218,75 kB dan `supabase`
  214,38 kB. Budget saat ini: maksimal 500 kB per chunk, 850 kB total JS,
  60 kB CSS, dengan batas khusus untuk chunk vendor. Hindari barrel file dan
  import yang menarik seluruh modul; evaluasi dampak bundle setiap dependensi
  baru. Naikkan budget hanya dengan alasan yang dicatat di PR.
- Error boundary global **sudah tergabung** di `src/App.tsx` melalui
  `AppErrorBoundary`. Error render menampilkan fallback yang dapat dioperasikan
  dengan keyboard dan memindahkan fokus ke judul. Kegagalan memuat chunk lazy
  memicu reload otomatis maksimal sekali per sesi tab; bila masih gagal,
  pengguna melihat fallback untuk muat ulang manual tanpa loop reload. Penanda
  sesi disimpan di `sessionStorage` (`sewa-yuk:chunk-reload-attempted`) dan
  dihapus setelah halaman berhasil dirender.
- Realtime memakai `useOnlineStatus` dan refetch saat channel `SUBSCRIBED`
  kembali atau browser online. Status `live` tidak ditampilkan saat offline.
  Perubahan status optimistis di dashboard admin dan reservasi tenant
  di-rollback bila request gagal tanpa menimpa perubahan yang sudah diterima
  dari Realtime. Privasi payload Realtime tetap menunggu BE-04.
- Halaman detail event memakai pola UX-01: di bawah 1024 px urutannya filter →
  peta → panel detail; di desktop peta di kiri dan filter + detail sticky di
  kanan. Filter memakai satu state dari halaman (`TenantFilter`). Pilihan booth
  memakai `aria-current`, Escape global melepas pilihan, dan viewport peta
  dapat digeser dengan tombol panah setelah diperbesar. Checkout mobile
  menaruh `Batal` sebelum aksi utama, memakai safe-area, dan tinggi `92dvh`
  dengan fallback `92vh`.
- Kanvas blueprint admin memisahkan seleksi dan drag keyboard: `Enter` memilih,
  `Space` memindahkan lewat sensor dnd-kit, dan `Escape` melepas pilihan.
  Legenda admin menampilkan empat status (Tersedia, Dipilih, Dipesan, Terisi)
  dan pilihan memakai `aria-current`. Regression test keyboard/fokus ada di
  `BlueprintCanvas.test.tsx`, `InteractiveMap.test.tsx`, dan
  `CheckoutModal.test.tsx`.
- Jalur gagal dan expiry dijaga unit test: `bookingExpiry.test.ts` (RPC sweep
  error/exception), `useTenantEventView.test.tsx` (rollback optimistic),
  `useBookingClock.test.tsx` (timer dibersihkan saat unmount), dan
  `useExpiredBookingSweep.test.tsx` (reject, unmount, deadline berubah).
  Ambang cakupan di `vite.config.ts` kini lines 74, branches 67, functions 83,
  statements 74; jalankan `npm run test:coverage` untuk memeriksanya.

### 12.1 Dokumen produk dan rilis

- `docs/product/PM-01-release-scope.md` — ruang lingkup, non-goal, risiko, dan
  kriteria sukses rilis berikutnya.
- `supabase/ERROR_CONTRACT.md` — kontrak error RPC dan matriks idempotensi.
- `supabase/DOUBLE_BOOKING.md` — jaminan satu booking aktif per booth.
- `qa_checklist_test_plan.md` — test plan, skenario UAT, dan status eksekusi.

## 13. Alur kontribusi

- Satu task dari `NEXT_TASKS.txt` dikerjakan pada satu branch dengan awalan
  sesuai jenisnya: `feature/`, `fix/`, `refactor/`, `test/`, `docs/`,
  `chore/`, atau `perf/`.
- Sebelum commit, jalankan `npm run verify` (lint, format, typecheck, unit
  test, build).
  Untuk perubahan UI, jalankan juga smoke dan audit aksesibilitas:

  ```bash
  npm run test:e2e -- e2e/smoke.spec.ts
  npm run test:e2e -- e2e/a11y.spec.ts
  ```

- Jangan mengubah routing, RPC/skema Supabase, logika Zustand, atau DnD yang
  sudah berjalan tanpa alasan kuat dan pengujian ulang.
- Perbarui `NEXT_TASKS.txt` (status + hasil verifikasi) dan
  `qa_checklist_test_plan.md` bila perilaku yang diuji berubah.
- Gunakan pesan commit ringkas dalam bahasa Inggris, misalnya
  `docs: sync project status and contribution guide`.
