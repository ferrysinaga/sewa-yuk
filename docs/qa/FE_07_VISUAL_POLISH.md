# Poles Tampilan dan Konsistensi Visual (FE-07)

Dokumen ini mencatat audit visual, perbaikan presentasi, dan bukti verifikasi
untuk task FE-07. Perubahan hanya menyentuh kelas presentasi (spacing, radius,
tipografi, copy, dan state) tanpa mengubah routing, query Supabase, kontrak RPC,
logika Zustand, atau perilaku DnD.

## 1. Lingkup

Halaman dan viewport yang diperiksa:

| Halaman               | 375 px | 768 px | 1280 px | Sumber data                         |
| --------------------- | :----: | :----: | :-----: | ----------------------------------- |
| `/`                   |   ya   |   ya   |   ya    | publik                              |
| `/event`              |   ya   |   ya   |   ya    | publik                              |
| `/event/:eventId`     |   ya   |   ya   |   ya    | publik (`hall-a`, `hall-b`)         |
| `/login`, `/register` |   ya   |   ya   |   ya    | publik                              |
| `/admin`              |   ya   |   ya   |   ya    | sesi + REST mock (tanpa kredensial) |
| `/admin/bookings`     |   ya   |   ya   |   ya    | sesi + REST mock (tanpa kredensial) |
| `/admin/blueprint`    |   ya   |   ya   |   ya    | sesi + REST mock (tanpa kredensial) |

Halaman terautentikasi tidak memakai akun staging. Sebuah skrip Playwright
sementara menyuntikkan sesi organizer palsu ke `localStorage` dan mencegat
respons `auth`/`rest` Supabase. Skrip tersebut tidak di-commit karena hanya alat
audit lokal; hasil tangkapannya disimpan di `docs/qa/screenshots/fe-07/`.

## 2. Temuan dan perbaikan

### Publik

1. **Header `/event` berdesakan di 768 px.** Ringkasan "ACARA TERSEDIA"
   terpotong menjadi dua baris karena layout berubah ke baris pada `sm`.
   Breakpoint dipindah ke `lg` sehingga teks tetap satu baris dan kolom
   ringkasan punya ruang.
2. **Kartu event tanpa booth menampilkan angka menyesatkan.** Event dengan
   `totalBooths = 0` menampilkan "0 dari 0 booth tersedia" dan bar "0% terisi".
   Sekarang kartu menampilkan "Belum ada booth / belum dipublikasikan" dan
   menyembunyikan progress bar. Badge kategori juga disembunyikan agar tidak
   mengulang copy yang sama.
3. **Panel ketersediaan event tanpa booth.** `TenantEventHeader` menulis
   "0 / 0 booth" dan "Semua booth tersedia untuk dipilih." Sekarang menjadi
   "Belum ada booth" dan "Booth untuk event ini belum dipublikasikan."
4. **Status jumlah acara di mobile.** Penghitung hasil filter kini mengambil
   baris penuh dan rata kanan di layar sempit, lalu kembali ke `ml-auto` pada
   `sm` ke atas.

### Admin dan tenant

5. **Ringkasan metrik tidak seragam.** Dashboard memakai strip `border-y`
   dengan padding mobile `px-1`, sedangkan halaman pemesanan memakai kartu
   `rounded-card` dengan `mt-8`. Keduanya kini memakai grid kartu yang sama
   (`mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4`, `rounded-card p-5`) dan
   tipografi label/nilai/sub yang sama. `BookingMetrics` tenant ikut diselaraskan
   dan diberi `tabular-nums`.
6. **Tipografi header tabel berbeda.** `BookingTable` memakai
   `text-compact tracking-wide`, sedangkan `BoothInventoryTable` memakai
   `text-tiny tracking-[0.12em]`. Keduanya kini memakai
   `text-tiny font-semibold uppercase tracking-[0.12em]`.
7. **Kepadatan tabel pemesanan.** Pada 1280 px tabel membutuhkan 1242 px di
   dalam kontainer 1214 px sehingga kolom **Aksi** terpotong. Padding sel
   dikurangi dari `px-5` ke `px-4`; tabel kini pas 1214 px dan seluruh aksi
   terlihat tanpa scroll horizontal.
8. **Radius kontrol tidak konsisten.** Banyak tombol, link bergaya tombol,
   input, dan select memakai `rounded-card-sm` (8 px) padahal token
   `control` (6 px) ditujukan untuk kontrol. Kontrol-kontrol tersebut kini
   memakai `rounded-control`; panel, kartu, thumbnail, dan badge tetap
   `rounded-card-sm`/`rounded-card`/`rounded-chip` sesuai peran.

## 3. Bukti before/after

Semua gambar ada di `docs/qa/screenshots/fe-07/`.

| Perubahan                      | Before                               | After                               |
| ------------------------------ | ------------------------------------ | ----------------------------------- |
| Header event explorer 768 px   | `event-explorer-768-before.png`      | `event-explorer-768-after.png`      |
| Kartu event tanpa booth 375 px | `event-explorer-375-before.png`      | `event-explorer-375-after.png`      |
| Panel ketersediaan 375 px      | `event-detail-hall-b-375-before.png` | `event-detail-hall-b-375-after.png` |
| Ringkasan dashboard 1280 px    | `admin-dashboard-1280-before.png`    | `admin-dashboard-1280-after.png`    |
| Tabel pemesanan 1280 px        | `admin-bookings-1280-before.png`     | `admin-bookings-1280-after.png`     |
| Tabel pemesanan 375 px         | `admin-bookings-375-before.png`      | `admin-bookings-375-after.png`      |
| Kartu denah 1280 px            | `admin-blueprint-1280-before.png`    | `admin-blueprint-1280-after.png`    |

Pengukuran tabel pemesanan pada 1280 px:

```text
before: tableScrollWidth 1242 / wrapClientWidth 1214
after : tableScrollWidth 1214 / wrapClientWidth 1214
pageScrollWidth tetap 1280 pada keduanya (tidak ada overflow halaman)
```

## 4. Verifikasi

- `npm run verify` — lulus (lint, format, typecheck, 223 unit test, build,
  budget bundle, secret scan).
- `npm run test:e2e -- e2e/smoke.spec.ts e2e/a11y.spec.ts e2e/responsive.spec.ts`
  — **11 lulus, 14 skip**.
  - Lulus: A11Y-01, A11Y-02, A11Y-07, A11Y-08, RESP-01/RESP-02 untuk tiga
    viewport, dan smoke login.
  - Skip dengan alasan eksplisit: A11Y-03/04/05/06/09 dan RESP-03/04/05
    membutuhkan `.env.e2e`, `E2E_EVENT_ID`, atau kredensial tenant/organizer
    staging. Tidak ada kegagalan.
- Tidak ada pelanggaran WCAG A/AA baru pada halaman publik yang diuji axe.
- Tidak ada horizontal scroll halaman pada 375/768/1280 px untuk landing dan
  event explorer; tabel admin tetap memakai scroll internal bila viewport
  lebih sempit dari konten.

## 5. Catatan

- Warna, radius, spacing, dan tipografi memakai token yang sudah ada di
  `src/style.css` dan `tailwind.config.ts`; tidak ada token baru.
- Perubahan copy hanya memperbaiki keadaan kosong (tanpa booth) dan tidak
  mengubah data atau status bisnis.
- Bukti halaman terautentikasi berasal dari mock REST. Verifikasi staging
  dengan akun nyata tetap menjadi bagian dari gate rilis QA/REL.
