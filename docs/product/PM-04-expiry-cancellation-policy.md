# PM-04 — Tinjauan Kebijakan Expiry, Pembatalan, dan Copy

| Atribut     | Keterangan                                                                               |
| ----------- | ---------------------------------------------------------------------------------------- |
| Pemilik     | Product Manager                                                                          |
| Kolaborator | UI/UX, BE, QA                                                                            |
| Status      | Review selesai; temuan copy dicatat untuk siklus berikutnya                              |
| Acuan       | `PM-02-uat-critical-flows.md`, `supabase/ERROR_CONTRACT.md`, `qa_checklist_test_plan.md` |
| Tanggal     | 11 November 2026                                                                         |

## 1. Tujuan review

Memastikan aturan **24 jam**, pembatalan, dan alasan pembatalan konsisten antara
database, UI, dan dokumentasi; serta memastikan copy menjelaskan akibat status
kepada tenant dan organizer.

## 2. Sumber yang diperiksa

| Lapisan     | Sumber                                                                                                                                                                                                                                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database    | `supabase/migrations/20261103000500_bookings.sql`, `20261105000000_booking_expiry.sql`, `20261111000000_rpc_idempotency_error_contract.sql`, `20261111000100_double_booking_guarantee.sql`                                                                                                                                                                    |
| Frontend    | `src/types/booking.ts`, `src/lib/booking.ts`, `src/components/checkout/CheckoutModal.tsx`, `src/components/map/TenantSidebar.tsx`, `src/pages/tenant/tenant-bookings/TenantBookingCard.tsx`, `src/pages/tenant/tenant-bookings/useTenantBookings.ts`, `src/pages/admin/admin-bookings/BookingTable.tsx`, `src/pages/admin/admin-bookings/useAdminBookings.ts` |
| Dokumentasi | `README.md`, `supabase/ERROR_CONTRACT.md`, `supabase/DOUBLE_BOOKING.md`, `qa_checklist_test_plan.md`, `docs/product/PM-02-uat-critical-flows.md`                                                                                                                                                                                                              |

## 3. Kebijakan kanonik

1. **Masa tahan**: booking `pending` menahan booth selama **24 jam** sejak
   dibuat. Nilai ini dipakai di `create_booking` dan ditampilkan di checkout.
2. **Kedaluwarsa**: booking `pending` yang melewati `expires_at` dibatalkan oleh
   `release_expired_bookings()` dengan `cancelled_reason='expired'`; booth
   kembali `Available`.
3. **Menunggu verifikasi**: booking `awaiting_confirmation` **tidak**
   kedaluwarsa. Tenant sudah melaporkan pembayaran; keputusan ada di organizer.
4. **Pembatalan tenant**: tenant dapat membatalkan booking `pending` atau
   `awaiting_confirmation` miliknya. Booking `confirmed` tidak dapat
   dibatalkan.
5. **Pembatalan organizer**: organizer dapat membatalkan booking
   `pending`/`awaiting_confirmation` milik tenant mana pun. Booking `confirmed`
   tidak dapat dibatalkan.
6. **Alasan pembatalan**: `expired` bila booking `pending` sudah lewat
   `expires_at`; selain itu `manual`.
7. **Refund/perpindahan booth**: tidak didukung. Tidak ada data atau komitmen
   bisnis yang membenarkan kebijakan ini pada rilis berjalan.

## 4. Matriks konsistensi

| Aturan                                        | Database                                           | UI                                                                                | Dokumentasi                              | Status                                            |
| --------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------- |
| Masa tahan 24 jam                             | `create_booking`: `now() + interval '24 hours'`    | `BOOKING_HOLD_HOURS = 24`; copy checkout “dalam 24 jam”                           | README, QA plan, PM-02, job-desk         | **Konsisten**, tetapi nilai ditulis di dua tempat |
| Sweep expiry                                  | `release_expired_bookings()` + pg_cron/fallback    | Dipanggil saat halaman dibuka, tombol **Perbarui status**, dan clock mencapai nol | README, QA plan EXP-01/EXP-06            | Konsisten                                         |
| `awaiting_confirmation` tidak expiry          | Sweep hanya memproses `pending`                    | Tidak ada countdown; instruksi bayar berhenti                                     | QA plan EXP-07, PM-02 AC-07              | Konsisten                                         |
| Tenant membatalkan booking sendiri            | `cancel_booking` cek `user_id`                     | Tombol **Batalkan Pesanan** hanya untuk `pending`/`awaiting_confirmation`         | QA plan BOOK-03/04/05, PM-02 AC-06       | Konsisten                                         |
| Organizer membatalkan booking                 | `cancel_booking` menerima role `organizer`         | Tombol **Batalkan** hanya untuk `pending`/`awaiting_confirmation`                 | QA plan ADM-02/03, PM-02 AC-06           | Konsisten                                         |
| `confirmed` tidak dapat dibatalkan            | `cancel_booking` menolak `confirmed`               | Aksi batal tidak ditampilkan untuk `confirmed`                                    | QA plan BOOK-05/ADM-03, PM-02 AC-06      | Konsisten                                         |
| Alasan `expired` vs `manual`                  | `cancelled_reason` diisi sesuai aturan             | Label **Kedaluwarsa** vs **Dibatalkan**                                           | ERROR_CONTRACT, QA plan EXP-01/02        | Konsisten                                         |
| Label “Dibayar”                               | `paid_at` diisi saat organizer mengonfirmasi       | Menampilkan **Dibayar** dari `paid_at`                                            | PM-03 mencatat gap timestamp pembayaran  | **Tidak konsisten secara semantik** (lihat F-01)  |
| Batas pembayaran pada `awaiting_confirmation` | `expires_at` tetap ada, tetapi tidak dipakai sweep | Baris **Batas pembayaran** tetap tampil tanpa countdown                           | QA plan EXP-07 menjelaskan perilaku ini  | **Ambigu** (lihat F-02)                           |
| Toast pembatalan                              | `cancel_booking` dapat mengembalikan `expired`     | Toast selalu “Pesanan dibatalkan…”                                                | ERROR_CONTRACT membedakan expired/manual | **Tidak konsisten** (lihat F-03)                  |
| Sumber nilai 24 jam                           | Hardcode di migrasi                                | Konstanta di `src/types/booking.ts`                                               | Ditulis di beberapa dokumen              | **Risiko drift** (lihat F-04)                     |
| Refund/transfer booth                         | Tidak ada RPC/kolom                                | Tidak ada aksi                                                                    | Tidak dijanjikan                         | Sesuai non-goal                                   |

## 5. Temuan dan rekomendasi

### F-01 — Label “Dibayar” memakai waktu verifikasi organizer

- **Bukti**: `confirm_booking` mengisi `paid_at = now()`; UI menampilkan
  **Dibayar** dari `paid_at` pada booking `confirmed`.
- **Dampak**: pengguna dan metrik dapat mengira `paid_at` adalah waktu tenant
  membayar, padahal itu waktu organizer memverifikasi.
- **Rekomendasi**: ubah label UI menjadi **Diverifikasi** untuk rilis ini, atau
  tambahkan `payment_reported_at` yang diisi `mark_booking_paid` lalu tampilkan
  **Dibayar** dari kolom itu dan **Diverifikasi** dari `paid_at`.
- **Pemilik**: FE (copy) + BE (kolom baru bila dipilih).
- **Prioritas**: P2; tidak memblokir rilis keandalan.

### F-02 — “Batas pembayaran” pada booking menunggu verifikasi

- **Bukti**: `TenantBookingCard` menampilkan baris **Batas pembayaran** untuk
  `pending` dan `awaiting_confirmation`, tetapi countdown hanya untuk `pending`.
- **Dampak**: tenant dapat mengira booking yang sudah dilaporkan masih bisa
  kedaluwarsa.
- **Rekomendasi**: untuk `awaiting_confirmation`, ubah label menjadi
  **Batas pembayaran awal** atau sembunyikan baris tersebut, dan tampilkan
  **Menunggu verifikasi organizer** sebagai status utama.
- **Pemilik**: UI/UX + FE.
- **Prioritas**: P2.

### F-03 — Toast pembatalan tidak membedakan kedaluwarsa

- **Bukti**: `handleCancel` di tenant dan admin selalu menampilkan “Pesanan
  dibatalkan…”, meskipun `cancel_booking` dapat mengembalikan
  `cancelled_reason='expired'`.
- **Dampak**: pengguna yang membatalkan booking yang sudah lewat batas melihat
  pesan yang berbeda dari label **Kedaluwarsa** di kartu.
- **Rekomendasi**: pilih toast berdasarkan `updated.cancelled_reason`:
  **“Pesanan kedaluwarsa dan booth kembali tersedia.”** untuk `expired`, dan
  **“Pesanan dibatalkan dan booth kembali tersedia.”** untuk `manual`.
- **Pemilik**: FE.
- **Prioritas**: P2.

### F-04 — Nilai 24 jam ditulis di dua tempat

- **Bukti**: `create_booking` memakai `interval '24 hours'`; frontend memakai
  `BOOKING_HOLD_HOURS = 24`.
- **Dampak**: perubahan kebijakan di satu sisi dapat membuat countdown UI
  berbeda dari `expires_at` database.
- **Rekomendasi**: jadikan durasi sebagai parameter/konfigurasi database
  (mis. `app_settings.booking_hold_hours`) atau minimal tambahkan komentar
  silang di kedua file dan test yang membandingkan nilai. Untuk rilis ini,
  dokumentasikan bahwa keduanya harus diubah bersamaan.
- **Pemilik**: BE + FE.
- **Prioritas**: P2.

### F-05 — Refund/perpindahan booth belum didukung

- **Bukti**: tidak ada RPC, kolom, atau copy refund; `cancel_booking` hanya
  melepas booth.
- **Dampak**: organizer/tenant dapat berasumsi ada refund otomatis.
- **Rekomendasi**: nyatakan eksplisit di FAQ/copy bahwa pembatalan tidak
  memproses refund otomatis dan perpindahan booth dilakukan manual di luar
  sistem. Kebijakan refund penuh ditunda sampai ada data dan kesepakatan bisnis.
- **Pemilik**: PM + UI/UX.
- **Prioritas**: P2.

## 6. Copy yang disarankan

| Konteks              | Copy saat ini                                    | Rekomendasi                                                                         |
| -------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Booking confirmed    | “Dibayar” + `paid_at`                            | “Diverifikasi” + `paid_at`, atau pisahkan “Dibayar” dan “Diverifikasi”              |
| Booking awaiting     | “Batas pembayaran” tanpa countdown               | “Batas pembayaran awal” atau sembunyikan; tonjolkan “Menunggu verifikasi organizer” |
| Toast cancel expired | “Pesanan dibatalkan dan booth kembali tersedia.” | “Pesanan kedaluwarsa dan booth kembali tersedia.”                                   |
| Kartu expired        | “Pesanan akan dibatalkan otomatis…”              | Tetap; tambahkan “Tekan Perbarui status untuk memperbarui sekarang.” (sudah ada)    |
| Checkout             | “Selesaikan pembayaran dalam 24 jam…”            | Tetap; pastikan angka berasal dari sumber yang sama dengan database                 |

## 7. Keputusan

| #   | Keputusan                                         | Alasan                                                                           |
| --- | ------------------------------------------------- | -------------------------------------------------------------------------------- |
| D1  | Masa tahan tetap 24 jam                           | Cukup untuk transfer/VA dan sesuai kapasitas organizer                           |
| D2  | `awaiting_confirmation` tidak kedaluwarsa         | Tenant sudah melaporkan pembayaran; keputusan ada di organizer                   |
| D3  | Booking `confirmed` tidak dapat dibatalkan        | Menghindari pembatalan sepihak setelah pembayaran diverifikasi                   |
| D4  | Tidak ada refund/transfer otomatis pada rilis ini | Belum ada data, proses bisnis, atau dukungan pembayaran                          |
| D5  | Temuan F-01..F-04 menjadi follow-up P2            | Tidak memblokir keandalan, tetapi perlu diselaraskan sebelum rilis UI berikutnya |
| D6  | F-05 dikomunikasikan sebagai batasan produk       | Mencegah ekspektasi refund yang tidak didukung                                   |

## 8. Verifikasi dan tindak lanjut

- Review statis database vs UI vs dokumentasi: **selesai** (matriks bagian 4).
- Uji satu booking kedaluwarsa di environment uji: **belum dijalankan** karena
  staging/.env.e2e belum tersedia; gunakan QA EXP-01/EXP-02 setelah OPS-04.
- Review bersama BE dan QA: **menunggu**; temuan F-01..F-04 perlu keputusan
  apakah masuk UX-04, FE-06, atau task baru pada siklus berikutnya.
- Tidak ada perubahan kode produksi pada task ini. Perubahan copy dan skema
  dilakukan lewat task FE/BE terpisah agar dapat diuji.
