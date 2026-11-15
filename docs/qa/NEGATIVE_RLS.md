# Suite Negatif Otorisasi dan RLS (QA-03)

Dokumen ini mencatat cakupan suite negatif RLS, cara menjalankannya, dan status
eksekusi. Suite ini melengkapi matriks SQL di `supabase/tests/rls_matrix.sql`:
suite Playwright membuktikan penolakan lewat jalur yang benar-benar dipakai
aplikasi (PostgREST, Auth, dan route guard), sedangkan skrip SQL membuktikan
policy dan grant di level database.

## 1. Prinsip

- **Tidak memakai service role.** Semua tes memakai anon key atau JWT pengguna
  hasil login, sehingga hasilnya mencerminkan hak akses nyata.
- **Tidak ada kegagalan palsu.** Bila `.env.e2e` atau data uji belum lengkap,
  tes di-skip dengan menyebut variabel yang kurang.
- **Tidak mengubah data produksi.** Arahkan hanya ke project staging. Tes tulis
  yang ditolak tidak boleh menghasilkan perubahan; verifikasi status booth
  dilakukan dengan membaca ulang sebagai anon.
- **Hasil dicatat per eksekusi.** Isi tabel hasil di bagian 5 setelah menjalankan
  suite di staging.

## 2. Prasyarat

Salin `.env.e2e.example` menjadi `.env.e2e`, lalu isi:

| Variabel                   | Dipakai untuk                                      |
| -------------------------- | -------------------------------------------------- |
| `E2E_SUPABASE_URL`         | Base URL PostgREST/Auth staging                    |
| `E2E_SUPABASE_ANON_KEY`    | Anon key untuk REST dan penukaran JWT              |
| `E2E_TENANT_A_EMAIL`       | Login tenant A dan pengambilan JWT                 |
| `E2E_TENANT_A_PASSWORD`    | Login tenant A                                     |
| `E2E_TENANT_B_EMAIL`       | Data tenant B (bila skenario perlu login tenant B) |
| `E2E_TENANT_B_PASSWORD`    | Login tenant B                                     |
| `E2E_ORGANIZER_EMAIL`      | JWT organizer untuk RLS-15                         |
| `E2E_ORGANIZER_PASSWORD`   | Login organizer                                    |
| `E2E_BOOTH_ID`             | Booth `Available` untuk percobaan tulis            |
| `E2E_DRAFT_EVENT_ID`       | Blueprint `draft` milik organizer                  |
| `E2E_TENANT_A_BOOKING_ID`  | Booking milik tenant A untuk RPC organizer         |
| `E2E_TENANT_B_BOOKING_ID`  | Booking milik tenant B untuk uji isolasi           |
| `E2E_UNAVAILABLE_BOOTH_ID` | Booth `Reserved`/`Booked` untuk RLS-17             |
| `E2E_DRAFT_BOOTH_ID`       | Booth pada blueprint draft untuk RLS-18            |

Data uji minimal:

- satu blueprint `published` dengan booth `Available`;
- satu blueprint `draft`;
- satu booking aktif milik tenant A dan satu milik tenant B;
- akun organizer dengan `app_metadata.role = "organizer"` dan akun tenant dengan
  role tenant (lihat `supabase/AUTH_ROLES.md`).

## 3. Matriks otomasi

File: `e2e/security.spec.ts`.

| Skenario | Yang dibuktikan                                                 | Metode                                                                         | Syarat data                                   |
| -------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------- |
| RLS-01   | Tenant yang membuka `/admin` dialihkan ke `/event`              | Login UI + route guard                                                         | Kredensial tenant A                           |
| RLS-02   | Tenant tidak dapat membaca blueprint draft                      | `GET /rest/v1/blueprints` dengan JWT tenant                                    | `E2E_DRAFT_EVENT_ID`                          |
| RLS-03   | Anon tidak dapat mengubah status booth dan status tidak berubah | `PATCH /rest/v1/booths` + baca ulang                                           | `E2E_BOOTH_ID`                                |
| RLS-04   | Anon tidak dapat menyisipkan booth                              | `POST /rest/v1/booths`                                                         | `E2E_BOOTH_ID` atau blueprint published/draft |
| RLS-05   | Tenant A tidak dapat membatalkan booking tenant B               | RPC `cancel_booking`                                                           | Booking tenant B                              |
| RLS-06   | Anon tidak dapat membaca tabel booking                          | `GET /rest/v1/bookings`                                                        | Anon key                                      |
| RLS-07   | Tenant tidak dapat menulis booth langsung                       | `PATCH` + `POST /rest/v1/booths`                                               | Booth dan blueprint uji                       |
| RLS-08   | Tenant tidak dapat menulis blueprint                            | `PATCH` + `POST /rest/v1/blueprints`                                           | Blueprint draft                               |
| RLS-09   | Tenant A tidak dapat membaca booking tenant B                   | `GET /rest/v1/bookings?id=eq.<tenant-B>`                                       | Booking tenant B                              |
| RLS-10   | Tenant tidak dapat memanggil RPC organizer                      | RPC `confirm_booking`                                                          | Booking tenant A                              |
| RLS-11   | Anon tidak dapat memanggil empat RPC tulis                      | RPC `create_booking`, `mark_booking_paid`, `cancel_booking`, `confirm_booking` | Booth uji                                     |
| RLS-15   | Organizer tidak dapat mengubah booking langsung                 | `PATCH /rest/v1/bookings` dengan JWT organizer                                 | Booking tenant A                              |
| RLS-17   | Tenant tidak dapat memesan booth `Reserved`/`Booked`            | RPC `create_booking`                                                           | Booth tidak tersedia                          |
| RLS-18   | Tenant tidak dapat memesan booth pada blueprint draft           | RPC `create_booking`                                                           | Booth pada blueprint draft                    |

Asersi utama:

- respons ditolak memiliki status `401/403`, error `42501`, atau `0` baris;
- RLS-05 mengharapkan hint `SWY_NOT_OWNER`;
- RLS-10 mengharapkan hint `SWY_FORBIDDEN`;
- RLS-11 mengharapkan `permission denied` atau `42501` untuk setiap RPC;
- RLS-17 mengharapkan hint `SWY_BOOTH_UNAVAILABLE`;
- RLS-18 mengharapkan hint `SWY_EVENT_NOT_PUBLISHED`;
- RLS-03 dan RLS-07 membaca ulang booth dan memastikan status tidak berubah.

## 4. Skenario yang tetap SQL/staging-only

Skenario berikut tidak diotomasi lewat Playwright karena membutuhkan Storage,
Auth admin, atau transaksi database:

| Skenario | Alasan                                                                | Lokasi verifikasi                        |
| -------- | --------------------------------------------------------------------- | ---------------------------------------- |
| RLS-12   | Upload/update/delete objek Storage butuh Storage API dan fixture file | `supabase/tests/rls_matrix.sql` bagian 2 |
| RLS-13   | Membaca aset publik bergantung pada bucket dan objek nyata            | Manual + `rls_matrix.sql` bagian 2       |
| RLS-14   | Eskalasi `user_metadata.role` harus diuji dengan refresh token        | `rls_matrix.sql` bagian 11               |
| RLS-16   | Backfill organizer dan registrasi baru mengubah `app_metadata`        | Manual + `npm run roles:backfill`        |
| DB-01    | Unique index anti double booking butuh dua transaksi nyata            | `supabase/DOUBLE_BOOKING.md`             |
| DB-02/03 | Replay migrasi pada database kosong dan idempotensi                   | `supabase/MIGRATIONS.md`                 |

Jalankan skrip SQL hanya di staging dengan `-v confirm_staging=yes`; skrip
melakukan rollback di akhir.

## 5. Hasil eksekusi

Eksekusi terakhir: **belum dijalankan terhadap staging**. Mesin pengembangan ini
tidak memiliki `.env.e2e`, project Supabase staging, atau data uji di atas, jadi
seluruh tes REST akan di-skip dengan alasan variabel yang kurang. Ini bukan
kelulusan.

| Tanggal | Environment | Lulus | Skip | Gagal | Catatan                               |
| ------- | ----------- | ----: | ---: | ----: | ------------------------------------- |
| —       | lokal       |     0 |   14 |     0 | `.env.e2e` dan staging belum tersedia |

Setelah staging tersedia, ganti baris di atas dengan hasil nyata dan lampirkan
output perintah pada PR rilis.

## 6. Cara menjalankan

```bash
# Daftar tes tanpa menjalankan (selalu bisa)
npx playwright test --list e2e/security.spec.ts

# Eksekusi penuh (butuh .env.e2e staging)
npx playwright test e2e/security.spec.ts

# Hanya satu skenario
npx playwright test e2e/security.spec.ts -g "RLS-05"
```

Untuk matriks database:

```bash
psql "$SUPABASE_DB_URL" \
  -v confirm_staging=yes \
  -v organizer_id='<uuid-organizer>' \
  -v tenant_a_id='<uuid-tenant-a>' \
  -v tenant_b_id='<uuid-tenant-b>' \
  -f supabase/tests/rls_matrix.sql
```

## 7. Triase kegagalan

- **`200` dengan data yang seharusnya tersembunyi**: policy `SELECT` terlalu
  longgar. Periksa `supabase/RLS_MATRIX.md` dan migrasi grant/policy terakhir.
- **`204` atau `0` baris pada update yang seharusnya ditolak**: tetap aman,
  tetapi catat sebagai observasi; pastikan grant tulis memang dicabut, bukan
  hanya policy yang menyaring.
- **`permission denied` untuk RPC**: sesuai harapan untuk anon (RLS-11). Bila
  muncul untuk tenant pada RPC yang sah, periksa grant `authenticated`.
- **Hint berbeda**: perbarui tes hanya bila kontrak di `supabase/ERROR_CONTRACT.md`
  memang berubah; jangan melonggarkan asersi tanpa persetujuan BE.
- **Tes gagal karena data uji berubah**: buat ulang fixture staging, jangan
  menurunkan asersi.

## 8. Referensi

- `e2e/security.spec.ts` — suite Playwright.
- `e2e/fixtures.ts` — helper REST/JWT dan daftar variabel.
- `.env.e2e.example` — contoh konfigurasi.
- `qa_checklist_test_plan.md` — TS-13.
- `supabase/tests/rls_matrix.sql` — matriks RLS level database.
- `supabase/RLS_MATRIX.md` — katalog policy dan grant.
- `supabase/ERROR_CONTRACT.md` — hint dan kode error RPC.
