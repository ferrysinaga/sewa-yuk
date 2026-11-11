# UX-04 — Audit Konsistensi Token, Radius, Tipografi, dan Copy

| Atribut     | Keterangan                                                                  |
| ----------- | --------------------------------------------------------------------------- |
| Pemilik     | UI/UX Designer                                                              |
| Kolaborator | Frontend Developer, QA                                                      |
| Status      | Selesai; token radius/tipografi/warna diterapkan, temuan copy dinormalisasi |
| Acuan       | `frontend.md`, `src/style.css`, `tailwind.config.ts`, UX-01, UX-03          |
| Tanggal     | 11 November 2026                                                            |

## 1. Tujuan dan metode

Audit ini memastikan tidak ada nilai desain baru yang muncul tanpa dokumentasi,
dan copy UI tetap spesifik. Metode yang dipakai:

1. Inventarisasi otomatis seluruh `src/**/*.{ts,tsx}` untuk warna mentah
   (hex/rgb/hsl), utilitas palet non-token, radius arbitrer, ukuran teks
   arbitrer, tracking, shadow/gradient/blur, `!important`, dan `console.log`.
2. Pemeriksaan manual komponen bersama (`StatePanel`, `Toast`, `Spinner`,
   `AppHeader`, `AuthLayout`, `CheckoutModal`) dan halaman landing, tenant,
   serta admin.
3. Penelusuran copy loading, kosong, gagal, dan sukses pada semua pemanggil
   `LoadingPanel`, `ErrorPanel`, `EmptyPanel`, dan `showToast`.
4. Verifikasi build, lint, typecheck, unit test, budget bundle, smoke test, dan
   a11y test.

## 2. Inventaris sebelum perubahan

### 2.1 Warna

| Temuan                              | Jumlah | Catatan                                                   |
| ----------------------------------- | -----: | --------------------------------------------------------- |
| Hex mentah di luar `src/style.css`  |      1 | `fill="#ffffff"` di `AuthLayout.tsx`                      |
| `text-white`                        |     44 | Teks di atas permukaan pine/danger/ink                    |
| `fill-white`                        |      6 | Label booth terpilih pada SVG                             |
| `bg-white`                          |      3 | Tombol CTA dan titik radio terpilih                       |
| `ring-white`                        |      2 | Focus ring di atas latar pine                             |
| `border-white/40`, `border-t-white` |      2 | Spinner tone putih                                        |
| Opacity modifier pada warna token   |      2 | `bg-ink/75`, `border-on-accent/40` tidak menghasilkan CSS |
| Shadow, gradient, blur, backdrop    |      0 | Bersih                                                    |
| `!important`                        |      0 | Bersih                                                    |
| `console.log` / `console.debug`     |      0 | Bersih                                                    |
| Emoji                               |      0 | Bersih                                                    |

Semua warna lain sudah memakai token `--color-*` melalui `tailwind.config.ts`.

### 2.2 Radius

Ada delapan nilai arbitrer, melebihi skala 6–10 px yang dianjurkan
`frontend.md`:

| Nilai | Jumlah | Pemakaian dominan                                          |
| ----- | -----: | ---------------------------------------------------------- |
| 10 px |     39 | Panel, kartu, modal (`rounded-[10px]`, `rounded-t-[10px]`) |
| 8 px  |     59 | Kartu dalam, input admin, tombol sekunder                  |
| 6 px  |    100 | Tombol utama, input, badge besar                           |
| 4 px  |     32 | Badge, tautan, tombol rapat                                |
| 2 px  |     19 | Swatch legenda dan track progress                          |
| 7 px  |      3 | Tile logo                                                  |
| 3 px  |      3 | Badge mikro dan skeleton                                   |
| 5 px  |      3 | Tombol zoom peta                                           |
| Total |    258 |                                                            |

### 2.3 Tipografi

| Ukuran  | Jumlah | Pemakaian dominan                    |
| ------- | -----: | ------------------------------------ |
| 11 px   |    102 | Badge, meta tabel, label sekunder    |
| 10 px   |     49 | Eyebrow, label peta, badge kecil     |
| 9 px    |      7 | Label harga di kanvas, overlay event |
| 2.5 rem |      1 | Judul hero (mobile)                  |
| 3.4 rem |      1 | Judul hero (desktop)                 |
| 17 px   |      1 | Paragraf hero desktop                |
| Total   |    161 |                                      |

Tracking memakai 11 nilai arbitrer (0.1em–0.3em dan -0.01em–-0.03em, total 68
pemakaian). Harga dan angka statistik sudah konsisten memakai `tabular-nums`
(56 pemakaian).

### 2.4 Copy

| Kategori         | Temuan                                                                |
| ---------------- | --------------------------------------------------------------------- |
| Loading          | Spesifik per halaman; tiga titik `...` bercampur dengan elipsis `…`   |
| Kosong           | Spesifik dan memberi langkah berikutnya                               |
| Gagal            | Memetakan pesan Supabase/jaringan; fallback generik hanya lapis akhir |
| Sukses           | Menyebut kode booking/denah dan akibat status                         |
| Placeholder form | Contoh nyata (nama event, venue, tanggal), bukan "Lorem"/"Input here" |
| Judul halaman    | Satu `h1` per halaman; panel memakai `h2`                             |

## 3. Perubahan yang diterapkan

### 3.1 Token baru

`src/style.css` menambahkan:

- `--color-on-accent: #ffffff` untuk foreground di atas pine/clay/danger.
- `--radius-micro|chip|control|card-sm|card` (2/4/6/8/10 px).
- `--text-micro|tiny|compact|body-lg|display-sm|display`
  (9/10/11/17 px, 2.5/3.4 rem).

`tailwind.config.ts` memetakan token tersebut sehingga kelas baru tersedia:
`rounded-micro`, `rounded-chip`, `rounded-control`, `rounded-card-sm`,
`rounded-card`, `text-micro`, `text-tiny`, `text-compact`, `text-body-lg`,
`text-display-sm`, `text-display`, serta `bg-surface`, `text-on-accent`,
`fill-on-accent`, dan `ring-surface`.

### 3.2 Penggantian nilai arbitrer

- **258 radius arbitrer → token.** Pemetaan: 2 px `micro`, 4 px `chip`,
  6 px `control`, 8 px `card-sm`, 10 px `card`. Outlier 3 px dinormalkan ke
  `chip` (4 px), 5 px ke `control` (6 px), dan 7 px ke `card-sm` (8 px).
- **161 ukuran teks arbitrer → token.** Pemetaan: 9 px `micro`, 10 px `tiny`,
  11 px `compact`, 17 px `body-lg`, 2.5 rem `display-sm`, 3.4 rem `display`.
  Token font-size sengaja tidak menetapkan line-height agar line-height per
  komponen tidak berubah.
- **57 utilitas putih → token.** `text-white` → `text-on-accent`,
  `fill-white` → `fill-on-accent`, `bg-white` → `bg-surface`,
  `ring-white` → `ring-surface`, `border-white/40` dan `border-t-white` →
  `border-on-accent`.
- **1 hex mentah → token.** `fill="#ffffff"` di `AuthLayout` menjadi
  `fill="var(--color-on-accent)"`.
- **Copy:** `...` pada label loading/tombol dinormalkan menjadi `…`
  (`Mengunggah…`, `Menyimpan…`, `Menghapus…`, `Membuat…`,
  `Memuat informasi event…`, `Memuat denah dari Supabase…`).

### 3.3 Token alpha eksplisit

Tailwind 3 tidak menghasilkan CSS untuk opacity modifier pada warna yang
didefinisikan sebagai `var(--color-*)`. Dua kelas lama karena itu tidak pernah
ada di build:

| Kelas lama            | Dampak                                              | Pengganti               |
| --------------------- | --------------------------------------------------- | ----------------------- |
| `bg-ink/75`           | Badge di atas thumbnail event tanpa latar           | `bg-ink-overlay`        |
| `border-on-accent/40` | Tiga sisi spinner tone putih memakai `currentColor` | `border-on-accent-soft` |

Token `--color-ink-overlay: rgba(34, 41, 35, 0.75)` dan
`--color-on-accent-soft: rgba(255, 255, 255, 0.4)` ditambahkan agar hasilnya
eksplisit dan tetap bisa diaudit. Aturan untuk kontribusi berikutnya: jangan
memakai `/<opacity>` pada warna token; tambahkan token alpha bila memang perlu.

Nilai CSS akhir tidak berubah untuk radius dan ukuran teks; hanya nama kelas
yang menjadi semantik. Ukuran CSS produksi bergerak dari 28,51 kB ke 28,77 kB.

## 4. Pengecualian yang disengaja

| Lokasi                                                                | Nilai                                                   | Alasan                                                               |
| --------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------- |
| `CheckoutModal.tsx`                                                   | `maxHeight: '92dvh'`                                    | Batas tinggi viewport dinamis; tidak bisa diekspresikan token statis |
| `CheckoutModal.tsx`                                                   | `paddingBottom: max(1rem, env(safe-area-inset-bottom))` | Safe area perangkat; bergantung `env()`                              |
| `InteractiveMap.tsx`                                                  | `transform: translate3d(...) scale(...)`                | Transform dihitung runtime dari state pan/zoom                       |
| `EventExplorer.tsx`, `EventSummaryList.tsx`, `StatusDistribution.tsx` | `width: ${...}%`                                        | Lebar progress bar dihitung dari data                                |
| `AuthLayout.tsx`                                                      | `fontSize="8"` / `fontSize="9"` pada `<text>` SVG       | Atribut presentasi SVG, bukan kelas Tailwind; mengikuti skala peta   |
| Semua komponen                                                        | `tracking-[...]` (11 nilai)                             | Dekoratif per komponen; didokumentasikan di bawah, bukan skala warna |

### Skala tracking yang dipakai

| Nilai                                   | Pemakaian                                    |
| --------------------------------------- | -------------------------------------------- |
| `0.18em`                                | Eyebrow section landing dan label kecil (20) |
| `0.14em`                                | Label status dan eyebrow sekunder (13)       |
| `0.1em`                                 | Label form/statistik (8)                     |
| `-0.02em`                               | Judul halaman dan angka besar (8)            |
| `0.16em`                                | Eyebrow panel dan error boundary (6)         |
| `0.3em`                                 | Eyebrow hero landing (5)                     |
| `0.12em`                                | Label modal checkout (4)                     |
| `0.2em`, `0.28em`, `-0.01em`, `-0.03em` | Masing-masing 1 pemakaian                    |

Tracking tidak dijadikan token karena setiap nilai terikat pada satu konteks
tipografi dan tidak dipakai ulang lintas komponen. Bila nanti dipakai ulang,
angkat tiga nilai terbanyak menjadi `tracking-eyebrow`, `tracking-label`, dan
`tracking-tight`.

## 5. Temuan copy dan keputusan

| Temuan                                                                    | Keputusan                                                                             |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Elipsis bercampur `...` dan `…`                                           | Dinormalkan ke `…` pada seluruh label UI                                              |
| `getAuthErrorMessage` berakhir di "Terjadi kesalahan. Silakan coba lagi." | Dipertahankan sebagai fallback terakhir; pesan spesifik Supabase dipetakan lebih dulu |
| `AppErrorBoundary` memakai "Terjadi kesalahan" untuk error non-chunk      | Dipertahankan; deskripsi menjelaskan data aman dan langkah pemulihan                  |
| Toast pembatalan belum membedakan `expired`                               | Di luar UX-04; sudah dicatat sebagai temuan PM-04 untuk siklus berikutnya             |
| Harga memakai `formatCurrency` + `tabular-nums`                           | Konsisten di kanvas, checkout, kartu booking, dan tabel admin                         |
| Status memakai label teks + warna, bukan warna saja                       | Sesuai UX-03; legenda kanvas memakai empat status dengan teks                         |

## 6. Verifikasi

- `npm run verify`: lint, format, typecheck, **198 unit test (27 file)**, build,
  dan budget bundle lulus.
- `npm run check:bundle`: total JS 790,09 kB (budget 850 kB), CSS 28,77 kB
  (budget 60 kB); semua chunk dalam budget.
- Build CSS memuat token baru dan nilainya benar
  (`--radius-control:6px`, `--text-compact:11px`, `--color-on-accent:#fff`,
  `.bg-ink-overlay`, `.border-on-accent-soft`).
- Inventaris ulang setelah perubahan: **0** radius arbitrer, **0** ukuran teks
  arbitrer, **0** utilitas `white`/`black`, **0** hex mentah di luar
  `style.css`.
- `npm run test:e2e -- e2e/smoke.spec.ts e2e/a11y.spec.ts`: 4 lulus
  (landing, event explorer, detail event, login), 3 skip karena `.env.e2e`
  belum tersedia. Pemeriksaan visual halaman terautentikasi tetap menunggu
  staging (OPS-04).

## 7. Tindak lanjut

1. Jalankan review visual landing, tenant, dan admin di staging setelah
   `.env.e2e` tersedia; fokus pada ukuran 3/5/7 px yang dinormalkan ke skala
   terdekat.
2. Bila tracking mulai dipakai ulang lintas komponen, angkat tiga nilai
   terbanyak menjadi token.
3. Temuan copy PM-04 (toast `expired`, label "Dibayar"/`paid_at`, kebijakan
   refund) ditangani pada siklus produk berikutnya, bukan di UX-04.
