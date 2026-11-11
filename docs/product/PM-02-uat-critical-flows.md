# PM-02 — Acceptance Criteria dan Skenario UAT Alur Kritis

| Atribut     | Keterangan                                                                  |
| ----------- | --------------------------------------------------------------------------- |
| Pemilik     | Product Manager                                                             |
| Kolaborator | QA, UI/UX                                                                   |
| Status      | Siap dipakai untuk UAT; hasil eksekusi belum diisi                          |
| Acuan       | `NEXT_TASKS.txt`, `qa_checklist_test_plan.md`, `supabase/ERROR_CONTRACT.md` |
| Environment | Staging/preview dengan Supabase, Realtime, Storage, dan akun uji            |

Dokumen ini adalah dasar lulus/tidak lulus UAT. QA tidak perlu menebak hasil
yang diharapkan: setiap skenario punya precondition, langkah, dan hasil yang
dapat diamati.

## 1. Model status yang diuji

### 1.1 Booking

| Status                  | Arti                                        | Transisi yang diizinkan                               |
| ----------------------- | ------------------------------------------- | ----------------------------------------------------- |
| `pending`               | Booth dikunci, menunggu pembayaran (24 jam) | `awaiting_confirmation`, `cancelled` (manual/expired) |
| `awaiting_confirmation` | Tenant menandai sudah bayar                 | `confirmed`, `cancelled` (manual)                     |
| `confirmed`             | Organizer memverifikasi pembayaran          | — (tidak dapat dibatalkan)                            |
| `cancelled`             | Dibatalkan manual atau kedaluwarsa          | — (idempoten bila dipanggil ulang)                    |

`cancelled_reason` bernilai `manual` atau `expired`. UI menampilkan label
**Kedaluwarsa** hanya untuk `expired`.

### 1.2 Booth

| Status      | Arti                                              |
| ----------- | ------------------------------------------------- |
| `Available` | Dapat dipesan                                     |
| `Reserved`  | Ditahan booking `pending`/`awaiting_confirmation` |
| `Booked`    | Booking `confirmed`                               |

### 1.3 Blueprint

| Status      | Visibilitas tenant          | Booking baru |
| ----------- | --------------------------- | ------------ |
| `draft`     | Tidak terlihat              | Ditolak      |
| `published` | Terlihat                    | Diizinkan    |
| `archived`  | Tidak menerima booking baru | Ditolak      |

## 2. Acceptance criteria per alur

### AC-01 — Menjelajah event dan memilih booth

- Tenant hanya melihat blueprint `published`.
- Booth `Available` dapat dipilih dengan mouse dan keyboard (Enter/Space).
- Booth `Reserved`/`Booked` tetap dapat diperiksa, tetapi aksi pesan nonaktif
  dan menjelaskan alasannya.
- Status booth tidak hanya dibedakan lewat warna.

### AC-02 — Checkout

- Ringkasan booth, kategori, harga, dan metode pembayaran terlihat sebelum
  konfirmasi.
- Metode yang didukung: `va`, `transfer`, `qris`.
- Klik konfirmasi dua kali tidak membuat dua booking.
- Modal dapat ditutup dengan Escape dan fokus kembali ke pemicu.
- Di 375 px tidak ada horizontal scroll dan tombol utama tetap terlihat
  (setelah FE-03; untuk rilis ini minimal tidak ada kontrol terpotong).

### AC-03 — Membuat booking

- Booking baru berstatus `pending`, kode `SWY-…`, `expires_at` ±24 jam.
- Booth berubah menjadi `Reserved` dan terlihat realtime di tab lain.
- Retry oleh pengguna yang sama pada booth yang sama mengembalikan booking
  yang sama, bukan baris baru.
- Booking `confirmed` milik pengguna yang sama ditolak `SWY_ALREADY_PAID`.
- Booking aktif milik tenant lain ditolak `SWY_BOOTH_UNAVAILABLE`.
- Blueprint `draft`/`archived` ditolak `SWY_EVENT_NOT_PUBLISHED` untuk tenant;
  organizer tetap boleh melakukan pratinjau.

### AC-04 — Menandai pembayaran

- Booking `pending` yang belum kedaluwarsa berubah menjadi
  `awaiting_confirmation`.
- Retry pada booking yang sudah `awaiting_confirmation` mengembalikan booking
  yang sama tanpa error.
- Booking `confirmed` ditolak `SWY_ALREADY_PAID`.
- Booking `pending` yang sudah lewat `expires_at` ditolak
  `SWY_BOOKING_EXPIRED`.
- Booking `cancelled` ditolak dengan pesan sesuai alasan (`expired`/`manual`).

### AC-05 — Verifikasi organizer

- Booking `awaiting_confirmation` berubah menjadi `confirmed`, `paid_at`
  terisi, dan booth menjadi `Booked`.
- Retry pada booking yang sudah `confirmed` mengembalikan booking yang sama.
- Booking `pending` yang lewat batas ditolak `SWY_BOOKING_EXPIRED`.
- Tenant yang memanggil `confirm_booking` ditolak `SWY_FORBIDDEN`.

### AC-06 — Pembatalan

- Tenant dapat membatalkan booking `pending`/`awaiting_confirmation` miliknya;
  booth kembali `Available`.
- Organizer dapat membatalkan booking tenant pada status yang sama.
- Booking `confirmed` tidak dapat dibatalkan; status dan booth tidak berubah.
- Retry pembatalan pada booking `cancelled` mengembalikan booking yang sama.
- Tenant lain tidak dapat membatalkan booking orang lain (`SWY_NOT_OWNER`).

### AC-07 — Kedaluwarsa

- Booking `pending` yang melewati `expires_at` dibatalkan oleh sweep dengan
  `cancelled_reason='expired'`; booth kembali `Available`.
- UI menampilkan label **Kedaluwarsa**, tombol bayar nonaktif, dan instruksi
  pembayaran tidak lagi ditawarkan.
- Booking `awaiting_confirmation` tidak ikut kedaluwarsa.
- Sweep dapat dipanggil berulang/paralel tanpa error dan tanpa perubahan ganda.
- Booth `Reserved`/`Booked` tanpa booking aktif dikembalikan ke `Available`.

### AC-08 — Realtime dan reconnect

- Perubahan booth/booking dari tab lain terlihat tanpa reload saat koneksi
  normal.
- Saat koneksi putus, badge menunjukkan **Koneksi terputus** dengan teks, bukan
  warna saja.
- Setelah reconnect, perubahan yang terlewat tersinkron tanpa reload manual.
- Tidak ada listener/channel ganda setelah beberapa kali reconnect.
- Tenant tidak menerima payload booking tenant lain.

### AC-09 — Otorisasi dan RLS

- Tenant yang membuka route organizer diarahkan ke `/event`.
- Tenant tidak dapat membaca booking tenant lain.
- Anon tidak dapat menulis booth/booking dan tidak dapat mengeksekusi RPC
  tulis.
- Tenant tidak dapat mengubah booth langsung.
- Blueprint draft tidak dapat dibaca tenant lewat UI maupun REST.

### AC-10 — Race condition dua tenant

- Dua tenant memilih booth yang sama dan menekan konfirmasi hampir bersamaan.
- Tepat satu booking berhasil; booth berubah `Reserved` satu kali.
- Tenant yang kalah menerima pesan
  **“Booth sudah tidak tersedia. Silakan pilih booth lain.”**
- Database tidak memiliki dua booking aktif pada booth yang sama.

### AC-11 — Error contract

- Setiap kegagalan RPC menampilkan pesan pengguna yang spesifik, bukan pesan
  mentah PostgreSQL.
- Hint `SWY_*` dipakai sebagai sumber utama; SQLSTATE menjadi fallback.
- Kasus minimum: booth tidak tersedia, booking tidak ditemukan, bukan pemilik,
  sudah dibayar, sudah kedaluwarsa, sudah dibatalkan, event belum published,
  dan status tidak valid.

### AC-12 — Denah dengan booking aktif

- Organizer tidak dapat menghapus blueprint yang masih punya booking aktif.
- Pesan menyebut jumlah booking aktif; data tidak berubah.
- Blueprint dengan seluruh booking `cancelled` boleh dihapus; riwayat booking
  tetap ada dengan `booth_id = null`.

## 3. Matriks UAT

Kolom **Ref** menunjuk skenario di `qa_checklist_test_plan.md`. Bila tidak ada,
skenario UAT ini menjadi acuan utama.

### Persiapan

- Environment staging/preview dengan Supabase, Realtime, dan Storage aktif.
- Akun: organizer, tenant A, tenant B.
- Minimal satu blueprint `published` dengan booth `Available`, satu blueprint
  `draft`, dan satu blueprint `archived`.
- `.env.e2e` terisi untuk tes otomatis.
- Catat ID booth dan blueprint yang dipakai agar data uji dapat dibersihkan.

### Skenario

| ID     | Skenario                               | Precondition                                              | Langkah                                                                                        | Hasil yang diharapkan                                                                                                  | Ref               |
| ------ | -------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------- |
| UAT-01 | Visibilitas blueprint                  | Blueprint published, draft, archived tersedia             | Buka `/event` sebagai tenant A; buka URL event draft/archived secara langsung                  | Hanya published yang terlihat; draft/archived tidak menampilkan booth dan tidak dapat dipesan                          | RLS-02            |
| UAT-02 | Pilih booth Available                  | Booth uji `Available`                                     | Klik booth; ulangi dengan Enter/Space                                                          | Panel detail tampil; tombol **Pesan booth ini** aktif; fokus terlihat                                                  | BOOK-01           |
| UAT-03 | Booth sudah diambil                    | Booth uji `Reserved` oleh tenant A                        | Buka sebagai tenant B, klik booth                                                              | Status **Dipesan**; tombol pesan nonaktif; tidak ada aksi yang dapat memaksa pesan                                     | SYNC-02           |
| UAT-04 | Checkout dasar                         | Booth `Available`                                         | Pilih metode `va`, `transfer`, `qris` bergantian; periksa ringkasan                            | Harga dan metode benar; instruksi sesuai metode; modal dapat ditutup dengan Escape                                     | BOOK-06           |
| UAT-05 | Buat booking                           | Booth `Available`                                         | Konfirmasi pesanan                                                                             | Booking `pending`, kode `SWY-…`, `expires_at` ±24 jam; booth `Reserved`; terlihat realtime                             | BOOK-01           |
| UAT-06 | Double submit create                   | Booth `Available`                                         | Klik konfirmasi dua kali cepat atau kirim dua request paralel                                  | Hanya satu booking; kode pesanan sama; tidak ada error mentah                                                          | BOOK-07           |
| UAT-07 | Tandai bayar                           | Booking `pending` belum kedaluwarsa                       | Klik **Sudah Bayar**; ulangi                                                                   | Status `awaiting_confirmation`; retry tidak mengubah data ganda; organizer melihatnya                                  | BOOK-02, BOOK-08  |
| UAT-08 | Verifikasi organizer                   | Booking `awaiting_confirmation`                           | Login organizer; klik **Verifikasi**; ulangi                                                   | Status `confirmed`; `paid_at` terisi; booth `Booked`; retry idempoten                                                  | ADM-01, ADM-06    |
| UAT-09 | Batalkan booking pending               | Booking `pending` milik tenant A                          | Tenant A klik **Batalkan** lalu konfirmasi; ulangi pada data yang sudah cancelled              | Status `cancelled` (`manual`); booth `Available`; retry mengembalikan booking yang sama                                | BOOK-03           |
| UAT-10 | Batalkan booking awaiting              | Booking `awaiting_confirmation`                           | Batalkan dari tenant dan organizer                                                             | Status `cancelled`; booth `Available`; riwayat tetap tampil                                                            | BOOK-04, ADM-02   |
| UAT-11 | Confirmed tidak dapat dibatalkan       | Booking `confirmed`                                       | Coba batalkan dari tenant dan organizer                                                        | Aksi tidak tersedia atau ditolak `SWY_INVALID_STATE`; status dan booth tidak berubah                                   | BOOK-05, ADM-03   |
| UAT-12 | Expiry sweep                           | Booking `pending`                                         | Set `expires_at = now() - interval '1 minute'`; buka `/bookings` atau klik **Perbarui status** | Booking `cancelled` (`expired`); booth `Available`; label **Kedaluwarsa**                                              | EXP-01, EXP-02    |
| UAT-13 | Bayar/verifikasi setelah expiry        | Booking `pending` lewat batas                             | Panggil **Sudah Bayar** dan **Verifikasi**                                                     | Keduanya ditolak `SWY_BOOKING_EXPIRED`; booth tidak menjadi `Booked`                                                   | EXP-03, EXP-04    |
| UAT-14 | Sweep paralel                          | Dua booking expired pada booth berbeda                    | Panggil `release_expired_bookings()` dua kali bersamaan                                        | Tidak ada error race; setiap booking diproses sekali; booth kembali `Available`                                        | EXP-05            |
| UAT-15 | Booth yatim                            | Booth `Reserved` tanpa booking aktif                      | Ubah status manual di SQL Editor; panggil sweep                                                | Booth kembali `Available`; query booth tertahan kosong                                                                 | EXP-08            |
| UAT-16 | Realtime normal                        | Dua tab tenant A/B                                        | Tenant A memesan booth; amati tab B                                                            | Tab B melihat `Reserved` tanpa reload; badge **Sinkron real-time**                                                     | SYNC-01           |
| UAT-17 | Realtime reconnect                     | Dua tab, koneksi normal                                   | Putuskan jaringan tab B; ubah data dari tab A; sambungkan kembali                              | Badge berubah **Koneksi terputus** lalu **Sinkron real-time**; perubahan terlewat tersinkron; tidak ada listener ganda | CONN-02, CONN-04  |
| UAT-18 | Race dua tenant                        | Dua tenant, satu booth `Available`                        | Buka checkout keduanya; tekan konfirmasi hampir bersamaan                                      | Tepat satu berhasil; yang kalah melihat **Booth sudah tidak tersedia**; tidak ada booking ganda                        | SYNC-03, QA-01    |
| UAT-19 | Otorisasi route/aksi                   | Akun tenant A dan anon                                    | Buka `/admin`, panggil RPC organizer, baca booking tenant B, tulis booth sebagai anon          | Semua ditolak/dialihkan; tidak ada data sensitif tampil                                                                | RLS-01..06, QA-03 |
| UAT-20 | Error contract                         | Booking/booth dalam berbagai kondisi                      | Picu booth diambil, booking hilang, bukan pemilik, sudah bayar, expired, cancelled, draft      | Pesan spesifik sesuai `supabase/ERROR_CONTRACT.md`; tidak ada pesan SQL mentah                                         | BOOK-09           |
| UAT-21 | Hapus blueprint dengan booking aktif   | Blueprint dengan booking `pending`/`awaiting`/`confirmed` | Organizer coba hapus blueprint                                                                 | Penghapusan ditolak; pesan menyebut jumlah booking aktif; data utuh                                                    | BLP-07            |
| UAT-22 | Hapus blueprint dengan riwayat selesai | Semua booking pada blueprint `cancelled`                  | Hapus blueprint                                                                                | Blueprint/booth terhapus; baris booking tetap dengan `booth_id = null`                                                 | BLP-08            |

## 4. Kriteria lulus UAT

UAT dinyatakan lulus bila:

1. Semua skenario **Wajib** lulus: UAT-01, UAT-02, UAT-05, UAT-06, UAT-07,
   UAT-08, UAT-09, UAT-11, UAT-12, UAT-13, UAT-18, UAT-19, UAT-20.
2. Tidak ada bug Critical/Major terbuka. Bug Minor boleh diterima dengan
   keputusan tertulis PM.
3. Tidak ada perbedaan status antara UI, RPC, dan database pada skenario yang
   dijalankan.
4. Data uji dikembalikan ke kondisi awal atau dicatat sebagai data uji
   terkontrol.

## 5. Format hasil

Isi tabel berikut saat eksekusi. Satu baris per skenario.

| ID     | Tanggal | Eksekutor | Environment | Hasil (Lulus/Gagal/Blocked) | Bukti | Catatan |
| ------ | ------- | --------- | ----------- | --------------------------- | ----- | ------- |
| UAT-01 |         |           |             |                             |       |         |
| UAT-02 |         |           |             |                             |       |         |
| UAT-03 |         |           |             |                             |       |         |
| UAT-04 |         |           |             |                             |       |         |
| UAT-05 |         |           |             |                             |       |         |
| UAT-06 |         |           |             |                             |       |         |
| UAT-07 |         |           |             |                             |       |         |
| UAT-08 |         |           |             |                             |       |         |
| UAT-09 |         |           |             |                             |       |         |
| UAT-10 |         |           |             |                             |       |         |
| UAT-11 |         |           |             |                             |       |         |
| UAT-12 |         |           |             |                             |       |         |
| UAT-13 |         |           |             |                             |       |         |
| UAT-14 |         |           |             |                             |       |         |
| UAT-15 |         |           |             |                             |       |         |
| UAT-16 |         |           |             |                             |       |         |
| UAT-17 |         |           |             |                             |       |         |
| UAT-18 |         |           |             |                             |       |         |
| UAT-19 |         |           |             |                             |       |         |
| UAT-20 |         |           |             |                             |       |         |
| UAT-21 |         |           |             |                             |       |         |
| UAT-22 |         |           |             |                             |       |         |

## 6. Sign-off

| Role            | Nama | Keputusan | Tanggal |
| --------------- | ---- | --------- | ------- |
| Product Manager |      |           |         |
| QA Engineer     |      |           |         |
| UI/UX Designer  |      |           |         |

Catatan: UAT belum dijalankan pada dokumen ini. Status task PM-02 mencakup
acceptance criteria dan skenario yang siap dieksekusi; hasil UAT diisi setelah
environment staging tersedia (OPS-04).
