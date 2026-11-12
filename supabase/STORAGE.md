# Validasi Storage dan Pembersihan File Yatim

Dokumen ini adalah hasil audit **BE-05** terhadap bucket `blueprint-assets`:
validasi unggahan, alur simpan/hapus, dan prosedur pembersihan file yang tidak
lagi direferensikan.

Dokumen ini **tidak** mengubah skema atau policy Storage. Perbaikan yang
memerlukan perubahan policy/Edge Function dicatat sebagai temuan dan tindak
lanjut.

## 1. Ringkasan eksekutif

- Bucket `blueprint-assets` bersifat publik, batas 5 MB, dan hanya menerima
  `image/png`, `image/jpeg`, `image/webp`. Batas ini ditegakkan oleh Storage,
  bukan hanya oleh validasi klien.
- Klien memvalidasi tipe, file kosong, dan ukuran sebelum upload. Metadata
  `image_url`/`image_path` hanya ditulis setelah upload berhasil, sehingga
  kegagalan upload tidak menyimpan referensi tanpa file.
- Policy tulis hanya untuk `authenticated` dengan role organizer. Tenant dan
  anon tidak dapat menulis objek.
- File yatim tetap mungkin muncul dari: save yang gagal setelah upload,
  upload yang ditinggalkan tanpa disimpan, dan hapus blueprint yang tidak
  menghapus gambarnya. Audit SQL dan skrip pembersih disediakan untuk itu.
- Menghapus baris `storage.objects` lewat SQL **tidak** menghapus file di
  backend Storage. Pembersihan harus memakai Storage API
  (`scripts/storage-orphans.mjs`) atau Dashboard.

## 2. Konfigurasi bucket

| Properti       | Nilai                                        | Ditegakkan oleh       |
| -------------- | -------------------------------------------- | --------------------- |
| ID / nama      | `blueprint-assets`                           | Migrasi               |
| Publik         | `true`                                       | Migrasi               |
| Batas ukuran   | `5 MB` (`5242880` byte)                      | Storage API           |
| MIME diizinkan | `image/png`, `image/jpeg`, `image/webp`      | Storage API           |
| Policy baca    | Semua role, `bucket_id = 'blueprint-assets'` | RLS `storage.objects` |
| Policy tulis   | `authenticated` + role organizer             | RLS `storage.objects` |
| Cache control  | `3600` detik                                 | Klien (`upload`)      |

Bucket publik berarti objek dapat diambil lewat public URL tanpa signed URL.
Jangan mengunggah dokumen sensitif ke bucket ini.

## 3. Lapisan validasi

### 3.1 Klien (`src/lib/storage.ts`)

`validateBlueprintImage(file)` menolak:

- tipe selain `image/png`, `image/jpeg`, `image/webp`;
- file berukuran 0 byte;
- file lebih dari 5 MB.

Ekstensi path diambil dari nama file bila dikenal (`png`, `jpg`, `jpeg`,
`webp`), lalu fallback ke MIME. Nama file tidak dipercaya untuk menentukan
tipe konten; `contentType` yang dikirim adalah `file.type`.

### 3.2 Storage (server)

Bucket menolak MIME di luar daftar dan ukuran di atas 5 MB meskipun klien
dimodifikasi. Ini adalah kontrol utama. Pesan error Storage dipetakan ke teks
ramah pengguna oleh `getBlueprintImageErrorMessage`.

### 3.3 Batasan

Validasi MIME berbasis header `Content-Type` yang dikirim klien, bukan
inspeksi isi file. Karena bucket hanya mengizinkan PNG/JPEG/WEBP dan gambar
ditampilkan lewat `<img>` (bukan SVG atau HTML), risiko stored XSS dari file
palsu tetap rendah. Jangan menambahkan `image/svg+xml` tanpa sanitasi.

## 4. Konvensi path dan alur

### 4.1 Path

```
blueprints/<blueprint-id yang disanitasi>/<timestamp>-<uuid>.<ext>
```

`getBlueprintFolder` mengganti karakter selain huruf, angka, `_`, dan `-`
menjadi `-`; ID kosong memakai `tanpa-id`. Path unik per upload, sehingga
mengganti gambar tidak menimpa file lama.

### 4.2 Upload dan simpan

1. Pengguna memilih file. Klien memvalidasi tipe/ukuran.
2. `uploadBlueprintImage` mengunggah ke path baru dengan `upsert: false`.
3. Setelah upload berhasil, `onChange` memperbarui draft (`image_url`,
   `image_path`). **Tidak ada referensi yang ditulis bila upload gagal.**
4. Saat menyimpan denah, metadata dan `image_path` ditulis ke
   `public.blueprints` setelah perubahan booth berhasil.
5. File lama dihapus setelah metadata baru tersimpan. Kegagalan hapus hanya
   memunculkan `console.warn`, sehingga metadata baru tetap valid.

### 4.3 Ganti dan hapus gambar

- Mengganti gambar: file pengganti diunggah lebih dulu; file pengganti yang
  belum tersimpan sebelumnya dihapus best-effort (`removeUnsavedImage`).
- Menghapus gambar: draft diubah menjadi kosong, lalu file yang belum
  tersimpan dihapus best-effort. File yang sudah tersimpan dihapus setelah
  metadata baru (tanpa gambar) tersimpan.
- Menutup halaman setelah upload tanpa menyimpan tidak memicu pembersihan;
  file menjadi yatim (S3).

## 5. Sumber file yatim

| ID  | Sumber                                                      | Mitigasi                                   |
| --- | ----------------------------------------------------------- | ------------------------------------------ |
| S1  | Menghapus blueprint tidak menghapus `image_path` di Storage | Audit + `scripts/storage-orphans.mjs`      |
| S2  | Upload berhasil, lalu penyimpanan metadata gagal            | Audit + skrip; file baru lebih dari 24 jam |
| S3  | Upload lalu pengguna menutup halaman tanpa menyimpan        | Audit + skrip; file baru lebih dari 24 jam |
| S4  | Ganti gambar berulang kali lalu gagal menyimpan             | `removeUnsavedImage` + audit + skrip       |
| S5  | File diunggah di luar aplikasi (Dashboard/API)              | Audit path convention                      |

Skrip pembersih memakai ambang usia (default 24 jam) agar unggahan yang sedang
berjalan tidak dihapus sebelum metadata tersimpan.

## 6. Audit dan pembersihan

### 6.1 Audit SQL (read-only, staging)

```bash
psql "$SUPABASE_DB_URL" \
  -v confirm_staging=yes \
  -f supabase/tests/storage_audit.sql
```

Skrip memeriksa:

- bucket publik, batas 5 MB, dan daftar MIME;
- empat policy Storage dan RLS aktif;
- `blueprints.image_path` yang tidak punya objek (referensi rusak);
- objek yang tidak direferensikan (file yatim) beserta ukuran dan usia;
- objek di luar folder `blueprints/`;
- `image_path`/`image_url` yang tidak konsisten.

Skrip tidak menghapus apa pun.

### 6.2 Skrip pembersih (Storage API)

```bash
# Dry-run: tampilkan objek yatim yang lebih tua dari 24 jam.
node scripts/storage-orphans.mjs --older-than-hours=24

# Hapus setelah daftar ditinjau.
node scripts/storage-orphans.mjs --older-than-hours=24 --delete
```

Environment yang dibutuhkan:

```bash
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

Skrip menolak kunci yang bukan service role. Jangan pernah menaruh service
role di `.env` frontend atau commit nilainya. Skrip membaca
`blueprints.image_path` (dengan pagination), menelusuri seluruh folder bucket,
lalu menghapus objek yatim per batch 100 lewat Storage API.

Mengapa bukan `delete from storage.objects`? Baris `storage.objects` hanyalah
metadata; file sebenarnya ada di backend Storage. Menghapus baris lewat SQL
akan meninggalkan file yang tidak lagi terdaftar dan tidak dapat dibersihkan
lewat Dashboard. Gunakan Storage API.

## 7. Temuan dan risiko

### S1 — Hapus blueprint tidak menghapus gambar (sedang)

`useAdminBlueprintList.handleDelete` menghapus booth lalu blueprint, tetapi
tidak memanggil `removeBlueprintImage`. Setiap blueprint yang dihapus
meninggalkan satu file yatim.

**Rekomendasi:** setelah blueprint berhasil dihapus, panggil
`removeBlueprintImage(blueprint.image_path)` secara best-effort (jangan gagalkan
hapus data bila file gagal dihapus). Sampai itu diterapkan, jalankan audit dan
skrip pembersih secara berkala.

### S2 — Save gagal setelah upload (rendah)

File sudah diunggah tetapi metadata belum tersimpan. Ini file tanpa referensi,
bukan referensi tanpa file. Skrip dengan ambang 24 jam dapat membersihkannya.

### S3 — Upload tanpa disimpan (rendah)

Pengguna menutup halaman sebelum menyimpan. Sama seperti S2; audit menandainya
sebagai file yatim.

### S4 — MIME berbasis header (rendah)

Klien dapat mengirim `Content-Type` palsu. Bucket tetap membatasi tiga tipe
gambar dan aplikasi menampilkan lewat `<img>`. Jangan menambahkan SVG/HTML dan
jangan memproses file unggahan sebagai kode.

### S5 — Policy Storage tidak memeriksa kepemilikan path (sedang, F2)

Semua organizer dapat menimpa atau menghapus objek mana pun di bucket. Ini
temuan F2 di `supabase/RLS_MATRIX.md`. Mitigasi sementara: satu tim organizer
tepercaya. Perbaikan jangka panjang: path `blueprints/<blueprint-id>/...` dan
policy tulis memeriksa folder tersebut.

### S6 — Bucket publik (rendah, F4)

Public URL melewati policy `SELECT`. Selama isinya gambar publik, ini sesuai
maksud. Bila kebutuhan privasi berubah, bucket harus privat dan memakai signed
URL.

## 8. Verifikasi

### 8.1 Unit test

```bash
npm test -- src/lib/storage.test.ts
```

`src/lib/storage.test.ts` mencakup validasi tipe/ukuran/kosong, batas tepat
5 MB, sanitasi folder, pemilihan ekstensi, opsi upload, propagasi error,
no-op hapus path kosong, dan pemetaan pesan error.

### 8.2 Staging

1. Jalankan `supabase/tests/storage_audit.sql`; pastikan katalog bucket/policy
   lulus dan catat jumlah referensi rusak/file yatim.
2. Upload gambar valid (PNG/JPEG/WEBP <= 5 MB) sebagai organizer.
3. Coba upload GIF/SVG, file kosong, dan file > 5 MB; pastikan ditolak dan
   tidak ada metadata yang tersimpan.
4. Ganti gambar, simpan, lalu pastikan file lama terhapus dan file baru
   direferensikan.
5. Hapus gambar lalu simpan; pastikan `image_path` menjadi null dan file
   terhapus.
6. Hapus blueprint; jalankan audit dan pastikan file lamanya muncul sebagai
   yatim (bukti S1), lalu bersihkan dengan skrip dry-run + `--delete`.
7. Jalankan `node scripts/storage-orphans.mjs` setelah pembersihan; jumlah
   yatim harus 0.

### 8.3 Batasan lokal

Tidak ada psql/Supabase CLI/Docker dan kredensial staging di mesin ini, sehingga
langkah 8.2 belum dijalankan. Unit test dan `npm run verify` dapat dijalankan
lokal.

## 9. Referensi

- `supabase/migrations/20261103000400_blueprint_images.sql`
- `src/lib/storage.ts`
- `src/components/admin/BlueprintImageUploader.tsx`
- `src/pages/admin/blueprint-editor/useBlueprintEditor.ts`
- `src/pages/admin/blueprint-list/useAdminBlueprintList.ts`
- `supabase/tests/storage_audit.sql`
- `scripts/storage-orphans.mjs`
- `supabase/RLS_MATRIX.md` (F2, F4)
