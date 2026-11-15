# Runtime, Cache, dan Uji Backup/Restore (OPS-06)

Dokumen ini adalah hasil **OPS-06**. Ada dua bagian: keselarasan versi runtime
lokal/CI/deploy, dan prosedur uji backup/restore database. Bagian restore masih
tertunda karena tidak ada project Supabase kedua di mesin ini.

## 1. Versi runtime yang disepakati

| Lingkungan         | Versi                                  | Sumber kebenaran                   |
| ------------------ | -------------------------------------- | ---------------------------------- |
| Lokal (disarankan) | Node 22 LTS                            | `.nvmrc` berisi `22`               |
| CI GitHub Actions  | Node 22                                | `.github/workflows/ci.yml`         |
| Vercel             | Node 22                                | Project Settings → Node.js Version |
| Dukungan package   | `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0` | `engines` di `package.json`        |
| npm                | 10+                                    | `engines` di `package.json`        |

Node 23 dan 25 adalah rilis _current_, bukan LTS. `jsdom`/Vitest yang dipakai
proyek ini menyatakan dukungan pada 22.22.2+, 24.15+, atau 26+, sehingga Node 25
hanya boleh dipakai untuk eksperimen dan akan memunculkan `EBADENGINE` saat
`npm install`. Verifikasi OPS-06 di mesin ini dijalankan pada Node 25.2.0 dan
lulus, tetapi versi yang direkomendasikan tetap 22 LTS.

### 1.1 Cara menyamakan versi lokal

```bash
# nvm
nvm install 22
nvm use 22

# fnm
fnm use

# Tanpa version manager: unduh Node 22 LTS dari nodejs.org
node --version   # harus v22.22.2 atau lebih baru di jalur 22.x
npm --version    # harus 10.x atau lebih baru
```

Setelah berpindah versi:

```bash
npm ci
npm run verify
```

`npm ci` memakai `package-lock.json` apa adanya dan gagal bila lockfile tidak
sinkron dengan `package.json`. Jangan memakai `npm install` di CI.

### 1.2 Vercel

- Set **Node.js Version** ke 22.x di Project Settings.
- Pastikan build command tetap `npm run build` dan install command `npm ci`.
- Bila Vercel membaca `.nvmrc`, nilai `22` sudah sejalan; tetap cek dashboard
  karena pengaturan project dapat menimpa file.

## 2. Cache dan durasi pipeline

- CI memakai `actions/setup-node` dengan `cache: npm`, sehingga unduhan
  dependensi memakai cache berdasarkan `package-lock.json`.
- Chromium Playwright diinstal setiap run. Ini disengaja agar versi browser
  selalu cocok dengan `@playwright/test`; cache browser dapat ditambahkan nanti
  bila durasi menjadi masalah, dengan kunci versi Playwright.
- Unit test memakai `pool: 'vmThreads'`; lihat `docs/qa/FLAKY_TESTS.md` untuk
  angka 10 run dan anggaran durasi.
- Job `verify` dibatasi 20 menit dengan target pemantauan 15 menit.

## 3. Uji backup/restore (tertunda)

### 3.1 Status

**Belum dijalankan.** Mesin ini tidak memiliki project Supabase kedua, akses
database staging, atau `pg_dump`/`psql`. Uji restore tidak boleh dilakukan pada
project produksi. Jalankan setelah OPS-04 menyediakan project staging/scratch.

### 3.2 Prosedur yang harus dijalankan

1. Tentukan project sumber (staging) dan project tujuan (scratch) yang berbeda.
2. Catat jumlah baris tabel utama sebelum backup:

   ```sql
   select 'blueprints' as tabel, count(*) from public.blueprints
   union all select 'booths', count(*) from public.booths
   union all select 'bookings', count(*) from public.bookings
   union all select 'profiles', count(*) from public.profiles
   order by tabel;
   ```

3. Ambil backup logis:

   ```bash
   pg_dump "$SUPABASE_DB_URL" \
     --format=custom \
     --no-owner \
     --file=backup-staging.dump
   ```

4. Restore ke project tujuan:

   ```bash
   pg_restore \
     --dbname="$SUPABASE_SCRATCH_DB_URL" \
     --no-owner \
     --clean \
     --if-exists \
     backup-staging.dump
   ```

5. Jalankan ulang query jumlah baris di project tujuan dan bandingkan.
6. Verifikasi objek penting: RLS aktif, policy, fungsi/RPC, trigger, unique
   partial index booking aktif, dan grant di `supabase/GRANTS.md`.
7. Uji alur baca/tulis minimum di aplikasi yang diarahkan ke project scratch:
   login, daftar event, buat booking, sweep expiry, dan buka `/admin`.
8. Catat waktu backup, waktu restore, jumlah baris, error, dan tindak lanjut.

### 3.3 Kriteria lulus

- Jumlah baris tabel utama sama sebelum dan sesudah restore.
- RLS dan grant tidak hilang.
- Booking aktif ganda tidak muncul setelah restore.
- Aplikasi dapat membaca dan menulis data uji di project scratch.
- Tidak ada data produksi yang dipakai atau diubah.

## 4. Verifikasi versi runtime

```bash
node --version
npm --version
cat .nvmrc
node -e "console.log(require('./package.json').engines)"
npm run verify
```

Hasil yang diharapkan: Node 22.x, npm 10+, `.nvmrc` = `22`, dan `engines`
sesuai tabel bagian 1.

## 5. Batasan

- Uji backup/restore nyata belum dilakukan; ini blocker yang harus ditutup
  sebelum klaim kesiapan operasi penuh.
- Angka durasi pipeline berasal dari lokal dan catatan QA-05, bukan pengukuran
  CI terbaru.
- Dokumen ini tidak menggantikan backup/PITR Supabase. Pastikan retensi backup
  aktif dan dicek sebelum migrasi besar.

## 6. Referensi

- `.nvmrc`
- `package.json` (`engines`)
- `.github/workflows/ci.yml`
- `docs/qa/FLAKY_TESTS.md`
- `docs/ops/ROLLBACK.md`
- `supabase/MIGRATIONS.md`
