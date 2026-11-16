# UX-05 — Copy dan Matriks Presentasi Status Booking

| Atribut     | Keterangan                                                                                                                                                              |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pemilik     | UI/UX Designer                                                                                                                                                          |
| Kolaborator | Frontend Developer, QA                                                                                                                                                  |
| Status      | Spesifikasi selesai; siap diimplementasikan pada FE-08                                                                                                                  |
| Acuan       | `docs/product/PM-04-expiry-cancellation-policy.md`, `frontend.md`, `src/types/booking.ts`, `src/lib/booking.ts`, `src/lib/boothDisplay.ts`, `qa_checklist_test_plan.md` |
| Tanggal     | 16 November 2026                                                                                                                                                        |

## 1. Tujuan dan ruang lingkup

Task ini menetapkan **satu sumber copy** untuk status booking agar tenant dan
organizer melihat label, akibat, dan tenggat yang sama di semua komponen. Acuan
kebijakan tetap PM-04; UX-05 hanya memutuskan bagaimana kebijakan itu
disampaikan.

Yang diatur:

- label dan deskripsi kanonik untuk setiap kondisi status booking;
- tone badge, aturan countdown, dan format waktu;
- copy tombol, toast, empty state, serta fallback data kosong;
- aturan status tidak boleh disampaikan lewat warna saja.

Yang **tidak** diatur: skema database, kontrak RPC, routing, nilai masa tahan
24 jam, dan perilaku sweep. Tidak ada perubahan kode produksi pada task ini.

## 2. Prinsip copy

1. **Satu kondisi, satu label.** Label yang sama dipakai di badge, filter,
   kartu tenant, dan tabel admin.
2. **Sebut akibat, bukan hanya keadaan.** Setiap status menjelaskan apa yang
   terjadi pada booth dan apa langkah berikutnya.
3. **Jangan bocorkan nama enum.** Nilai database (`pending`,
   `awaiting_confirmation`, `confirmed`, `cancelled`, `expired`, `Booked`)
   tidak boleh muncul di copy pengguna.
4. **Bedakan "menunggu tindakan Anda" dan "menunggu pihak lain".** `pending`
   adalah tugas tenant; `awaiting_confirmation` adalah tugas organizer.
5. **Angka waktu hanya tampil bila masih menjadi tenggat aktif.** Countdown
   hanya untuk `pending` yang belum lewat batas.
6. **Status tidak boleh hanya dibedakan warna** (WCAG 1.4.1). Badge selalu
   berisi teks; dot dan ikon bersifat dekoratif.
7. **Kapitalisasi.** Judul halaman, label status, dan label tombol memakai
   Title Case; kalimat, toast, dan paragraf memakai sentence case.
8. **Istilah baku.** `booth`, `tenant`/`penyewa`, `organizer`, `pesanan`
   (bukan "order"/"booking"), `kedaluwarsa` (bukan "kadaluarsa"/"expired"),
   `verifikasi` (bukan "approve"), `terisi` untuk booth `Booked`.
9. **Tanpa placeholder.** Tidak ada "Lorem", "TODO", "TBD", atau teks contoh
   yang tidak bisa dijalankan pengguna.
10. **Angka dari satu sumber.** Nilai 24 jam dan format tanggal/waktu tidak
    ditulis ulang di komponen.

## 3. Matriks status kanonik

| Kondisi data                                        | Label kanonik           | Makna untuk pengguna                                                           | Status booth | Aksi tenant                        | Aksi organizer       | Countdown | Tone   |
| --------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------ | ------------ | ---------------------------------- | -------------------- | --------- | ------ |
| `pending`, belum lewat `expires_at`                 | **Menunggu Pembayaran** | Pesanan dibuat, booth ditahan 24 jam sampai pembayaran dilaporkan.             | Dipesan      | Saya Sudah Bayar, Batalkan Pesanan | Konfirmasi, Batalkan | Ya        | Clay   |
| `pending`, sudah lewat `expires_at`, menunggu sweep | **Kedaluwarsa**         | Batas pembayaran terlewat; pesanan akan dibatalkan otomatis dan booth dilepas. | Dipesan      | Batalkan Pesanan                   | Batalkan             | Tidak     | Clay   |
| `awaiting_confirmation`                             | **Menunggu Verifikasi** | Tenant sudah mengirim konfirmasi bayar; organizer belum memverifikasi.         | Dipesan      | Batalkan Pesanan                   | Konfirmasi, Batalkan | Tidak     | Netral |
| `confirmed`                                         | **Terkonfirmasi**       | Pembayaran diverifikasi organizer; booth resmi menjadi milik tenant.           | Terisi       | —                                  | —                    | Tidak     | Pine   |
| `cancelled`, `cancelled_reason = 'manual'`          | **Dibatalkan**          | Dibatalkan tenant atau organizer; booth kembali tersedia.                      | Tersedia     | —                                  | —                    | Tidak     | Muted  |
| `cancelled`, `cancelled_reason = 'expired'`         | **Kedaluwarsa**         | Dibatalkan otomatis karena batas pembayaran terlewat; booth kembali tersedia.  | Tersedia     | —                                  | —                    | Tidak     | Clay   |

Pemetaan tone ke token yang sudah ada (tanpa token baru):

| Tone   | Badge                                   | Dot            | Arti visual                      |
| ------ | --------------------------------------- | -------------- | -------------------------------- |
| Clay   | `bg-clay-soft text-clay-dark ring-line` | `bg-clay`      | Butuh perhatian atau waktu habis |
| Netral | `bg-canvas text-ink ring-line`          | `bg-clay-dark` | Menunggu tindakan pihak lain     |
| Pine   | `bg-pine-soft text-pine-dark ring-line` | `bg-pine`      | Selesai / berhasil               |
| Muted  | `bg-unavailable text-muted ring-line`   | `bg-muted`     | Nonaktif, tidak ada tindakan     |

Bentuk badge tetap: `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1
text-compact font-semibold ring-1 ring-inset` dengan dot `h-1.5 w-1.5
rounded-full` dan `aria-hidden="true"`.

**CH-01 (perubahan tone):** `awaiting_confirmation` saat ini memakai
`bg-surface text-pine-dark` sehingga terbaca seperti status berhasil. Tone
diganti ke Netral agar jelas bahwa yang ditunggu adalah tindakan organizer.

## 4. Matriks komponen × status

| Komponen                   | Menunggu Pembayaran                | Menunggu Verifikasi                    | Terkonfirmasi            | Dibatalkan                        | Kedaluwarsa                 |
| -------------------------- | ---------------------------------- | -------------------------------------- | ------------------------ | --------------------------------- | --------------------------- |
| Badge tenant/admin         | Menunggu Pembayaran                | Menunggu Verifikasi                    | Terkonfirmasi            | Dibatalkan                        | Kedaluwarsa                 |
| Filter chip tenant         | Menunggu Pembayaran (n)            | Menunggu Verifikasi (n)                | Terkonfirmasi (n)        | Dibatalkan (n)                    | — (termasuk di Dibatalkan)  |
| Select status admin        | Menunggu Pembayaran                | Menunggu Verifikasi                    | Terkonfirmasi            | Dibatalkan (termasuk kedaluwarsa) | — (termasuk di Dibatalkan)  |
| Baris tenggat kartu tenant | Batas pembayaran + Sisa HH:MM:SS   | Batas pembayaran awal (tanpa hitungan) | —                        | —                                 | Batas pembayaran (terlewat) |
| Panel info kartu tenant    | Instruksi pembayaran               | Menunggu verifikasi organizer          | Pembayaran terverifikasi | Pesanan dibatalkan…               | Pesanan kedaluwarsa…        |
| Tombol tenant              | Saya Sudah Bayar, Batalkan Pesanan | Batalkan Pesanan                       | —                        | —                                 | Batalkan Pesanan            |
| Tombol admin               | Konfirmasi, Batalkan               | Konfirmasi, Batalkan                   | —                        | —                                 | Batalkan                    |
| Metrik                     | Menunggu pembayaran                | Perlu verifikasi                       | Terkonfirmasi            | —                                 | —                           |

Catatan filter: status tersimpan tetap `cancelled`, sehingga chip **Dibatalkan**
mencakup pembatalan manual dan kedaluwarsa. Chip diberi `aria-label`
"Filter Dibatalkan, termasuk pesanan kedaluwarsa" dan halaman tenant
menampilkan teks bantuan kecil **"Termasuk pesanan kedaluwarsa."** di bawah
filter agar badge **Kedaluwarsa** tidak dianggap hilang dari daftar.

## 5. Copy rinci per komponen

### 5.1 Kartu pesanan tenant (`TenantBookingCard`)

| Elemen            | Menunggu Pembayaran                                                      | Menunggu Verifikasi                                                                  | Terkonfirmasi                                                                    | Dibatalkan                                                                | Kedaluwarsa                                                                                                 |
| ----------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Panel info        | Instruksi pembayaran · {metode} + baris instruksi + catatan simulasi     | "Konfirmasi pembayaran sudah dikirim. Organizer akan memverifikasi pembayaran Anda." | "Pembayaran terverifikasi. Booth sudah resmi menjadi milik Anda pada event ini." | "Pesanan dibatalkan. Booth sudah dilepas dan dapat dipesan penyewa lain." | "Pesanan kedaluwarsa karena batas pembayaran terlewat. Booth sudah dilepas dan dapat dipesan penyewa lain." |
| Baris tenggat     | `Batas pembayaran` + tanggal + `Sisa HH:MM:SS` (tabular-nums, tone clay) | `Batas pembayaran awal` + tanggal (muted, tanpa hitungan)                            | —                                                                                | —                                                                         | `Batas pembayaran (terlewat)` + tanggal + `Kedaluwarsa`                                                     |
| Label waktu akhir | —                                                                        | —                                                                                    | `Diverifikasi` + `paid_at` (menggantikan label `Dibayar`)                        | `Dibatalkan` + `cancelled_at`                                             | `Kedaluwarsa` + `cancelled_at`                                                                              |
| Tombol            | `Batalkan Pesanan`, `Saya Sudah Bayar`                                   | `Batalkan Pesanan`                                                                   | —                                                                                | —                                                                         | `Batalkan Pesanan`                                                                                          |

Aturan tambahan:

- Untuk `awaiting_confirmation`, baris tenggat **tidak** memakai tone clay dan
  **tidak** menampilkan countdown. Tambahkan keterangan satu baris:
  **"Batas ini tidak berlaku setelah konfirmasi pembayaran dikirim."**
- Untuk `pending` yang sudah lewat batas, instruksi pembayaran disembunyikan
  dan tombol **Saya Sudah Bayar** tidak ditampilkan.
- Panel info `awaiting_confirmation` tidak boleh menyebut "Booked"; gunakan
  **"Terisi"**.

### 5.2 Tabel pemesanan admin (`BookingTable`)

| Elemen                 | Copy kanonik                                                                                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header kolom           | Kode, Tenant, Event, Booth, Total, Status, Dibuat, Aksi                                                                                                           |
| Fallback tenant        | `Nama tenant belum diisi` (baris kedua: `—`)                                                                                                                      |
| Fallback event         | `—`                                                                                                                                                               |
| Fallback booth         | `Booth dihapus`                                                                                                                                                   |
| Tombol konfirmasi      | `Konfirmasi` dengan `aria-label` "Konfirmasi pembayaran {kode}"                                                                                                   |
| Tombol batal           | `Batalkan` dengan `aria-label` "Batalkan pesanan {kode}"                                                                                                          |
| Konfirmasi inline      | Judul "Batalkan pesanan {kode}?", deskripsi "Booth akan tersedia kembali untuk penyewa lain. Tindakan ini tidak dapat dibatalkan.", tombol "Ya, batalkan pesanan" |
| Empty state tabel      | Baris `colSpan={8}`: "Tidak ada pesanan pada filter ini" + "Coba ubah filter atau kata kunci pencarian."                                                          |
| Teks pagination kosong | `Tidak ada pesanan`                                                                                                                                               |

### 5.3 Toast

| Aksi                             | Kondisi           | Copy                                                           | Varian  |
| -------------------------------- | ----------------- | -------------------------------------------------------------- | ------- |
| Tenant kirim konfirmasi bayar    | sukses            | Konfirmasi pembayaran dikirim. Menunggu verifikasi organizer.  | success |
| Tenant batalkan pesanan          | `manual`          | Pesanan dibatalkan dan booth kembali tersedia.                 | success |
| Tenant batalkan pesanan          | `expired`         | Pesanan kedaluwarsa dan booth kembali tersedia.                | success |
| Admin batalkan pesanan           | `manual`          | Pesanan {kode} dibatalkan. Booth kembali tersedia.             | success |
| Admin batalkan pesanan           | `expired`         | Pesanan {kode} kedaluwarsa. Booth kembali tersedia.            | success |
| Admin konfirmasi pembayaran      | sukses            | Pembayaran {kode} dikonfirmasi. Booth menjadi terisi.          | success |
| Sweep otomatis / Perbarui status | n > 0             | {n} pesanan kedaluwarsa dibatalkan dan booth kembali tersedia. | info    |
| Aksi gagal (tenant/admin)        | error kontrak RPC | Gagal {aksi}: {pesan dari getBookingErrorMessage}              | error   |

Toast sudah memakai `role="status"`/`role="alert"` di dalam region
`aria-live="polite"`; tidak perlu perubahan struktur.

### 5.4 Empty state

| Konteks                     | Judul                             | Deskripsi                                                       | Aksi       |
| --------------------------- | --------------------------------- | --------------------------------------------------------------- | ---------- |
| Tenant, belum punya pesanan | Belum ada pesanan                 | Pilih booth pada peta event untuk membuat pesanan pertama Anda. | Cari Booth |
| Tenant, filter tanpa hasil  | Tidak ada pesanan pada filter ini | Coba pilih filter status lain untuk melihat pesanan Anda.       | —          |
| Admin, filter tanpa hasil   | Tidak ada pesanan pada filter ini | Coba ubah filter atau kata kunci pencarian.                     | —          |
| Admin, belum ada pesanan    | Belum ada pesanan                 | Pesanan tenant akan muncul di sini setelah booth dipesan.       | —          |

### 5.5 Checkout dan peta

| Konteks                        | Copy kanonik                                                                                                                                    |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Dialog checkout, sebelum bayar | "Saat dikonfirmasi, pesanan dibuat dan booth dikunci untuk Anda. Selesaikan pembayaran dalam {BOOKING_HOLD_HOURS} jam agar booth dapat terisi." |
| Dialog checkout, setelah kunci | "Status booth: Dipesan. Selesaikan pembayaran dalam {BOOKING_HOLD_HOURS} jam melalui halaman Pesanan Saya."                                     |
| Instruksi transfer/QRIS        | Catatan simulasi tetap; rujuk tombol dengan label persis `Saya Sudah Bayar`.                                                                    |
| Panel booth tenant, Reserved   | "Booth ini sedang ditahan untuk penyewa lain dan belum bisa dipesan."                                                                           |
| Panel booth tenant, Booked     | "Booth ini sudah terisi. Pilih booth bertanda tersedia untuk melanjutkan."                                                                      |
| Label status booth             | Tersedia / Dipesan / Terisi                                                                                                                     |

Angka `{BOOKING_HOLD_HOURS}` dibaca dari `src/types/booking.ts`; tidak boleh
ditulis sebagai literal "24" di komponen mana pun.

## 6. Countdown dan format waktu

- Format: `Sisa HH:MM:SS` dari `formatRemaining` (tabular-nums, tone clay).
- Hanya untuk `pending` yang belum melewati `expires_at`.
- Saat mencapai nol: teks berubah menjadi **Kedaluwarsa** dan badge ikut
  berubah; sweep dijalankan sekali oleh hook yang sudah ada.
- `awaiting_confirmation`: tanpa countdown dan tanpa tone peringatan.
- Tanggal memakai `formatDateTime` (locale `id-ID`, `dateStyle: medium`,
  `timeStyle: short`). Tidak ada format tanggal ad hoc di komponen.
- Sisa waktu negatif atau `expires_at` tidak valid ditampilkan `—`, bukan
  angka negatif.

## 7. Aksesibilitas

1. **Badge**: teks selalu ada; dot dekoratif `aria-hidden="true"`. Tidak ada
   status yang hanya dibedakan warna.
2. **Countdown**: `role="timer"` dengan `aria-live="off"` agar pembaca layar
   tidak dibombardir tiap detik. Sediakan `aria-label` kalimat lengkap
   ("Sisa waktu pembayaran 3 jam 12 menit") yang diperbarui per menit.
3. **Perubahan status**: setelah RPC atau realtime, perubahan diumumkan lewat
   toast (`role="status"`, `aria-live="polite"`) yang sudah ada. Jangan
   menambahkan `aria-live` pada badge agar tidak dobel.
4. **Filter**: chip memakai `aria-pressed`; grup filter memakai
   `aria-label="Filter status pesanan"`; chip Dibatalkan menjelaskan cakupan
   kedaluwarsa lewat `aria-label`.
5. **Kontras**: pasangan token di bagian 3 sudah lolos audit UX-04. Label
   `text-muted` hanya untuk teks sekunder, bukan status utama.
6. **Fokus**: semua tombol status memakai `focus-visible:ring-2` dengan offset
   di atas `bg-surface`.
7. **Target sentuh**: aksi utama pada kartu tenant minimal 44 px di viewport
   sempit (sudah dipenuhi `py-2` + `text-xs`; jangan dikurangi).

## 8. Istilah yang diganti

| Istilah saat ini                | Lokasi                                  | Masalah                                      | Ganti dengan                |
| ------------------------------- | --------------------------------------- | -------------------------------------------- | --------------------------- |
| `Booked`                        | toast admin, panel kartu tenant, metrik | Nama enum Inggris bocor ke copy pengguna     | Terisi                      |
| `Dibayar`                       | kartu tenant status `confirmed`         | Menyesatkan: `paid_at` diisi saat verifikasi | Diverifikasi                |
| `Batas pembayaran` (awaiting)   | kartu tenant                            | Terlihat seperti tenggat yang masih aktif    | Batas pembayaran awal       |
| `Pesanan dibatalkan…` (expired) | toast tenant/admin                      | Tidak membedakan sebab pembatalan            | Copy per `cancelled_reason` |
| `booth dihapus`                 | sel tabel admin                         | Huruf kecil dan ambigu                       | Booth dihapus               |
| `Tanpa nama`                    | sel tabel admin                         | Bukan kalimat lengkap                        | Nama tenant belum diisi     |
| `...`                           | label tombol                            | Tiga titik ASCII, bukan elipsis              | `…`                         |
| `kadaluarsa` / `expired`        | copy mana pun                           | Tidak baku / istilah internal                | kedaluwarsa                 |
| `order` / `booking`             | copy mana pun                           | Istilah campur bahasa                        | pesanan                     |

## 9. Keputusan

| #   | Keputusan                                                                              | Alasan                                                               |
| --- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| D1  | Label `paid_at` menjadi **Diverifikasi**, bukan **Dibayar**                            | `paid_at` diisi `confirm_booking`, bukan saat tenant membayar (F-01) |
| D2  | `awaiting_confirmation` menampilkan **Batas pembayaran awal** tanpa countdown          | Menghindari kesan masih bisa kedaluwarsa (F-02)                      |
| D3  | Toast pembatalan dibedakan `expired` dan `manual`                                      | Menyamakan pesan dengan badge dan alasan di database (F-03)          |
| D4  | Nilai 24 jam hanya dari `BOOKING_HOLD_HOURS` dan parameter database                    | Mencegah drift antara countdown dan `expires_at` (F-04)              |
| D5  | Tone `awaiting_confirmation` menjadi Netral                                            | Status "menunggu organizer" bukan hasil akhir (CH-01)                |
| D6  | Filter Dibatalkan mencakup kedaluwarsa, dijelaskan lewat `aria-label` dan teks bantuan | Tidak menambah status turunan di query, tetap satu sumber data       |
| D7  | Istilah "Terisi" menggantikan "Booked" di seluruh copy                                 | Konsisten dengan `BOOTH_STATUS_LABEL.Booked`                         |
| D8  | Tidak ada token warna, radius, atau ukuran baru                                        | Mengikuti UX-04 dan `frontend.md`                                    |

## 10. Dampak implementasi FE-08

| File                                                        | Perubahan yang diharapkan                                                                      |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/lib/bookingStatus.ts` (baru)                           | Satu modul pemetaan status: label, tone, deskripsi, aturan countdown, copy toast, dan aksi     |
| `src/types/booking.ts`                                      | Sumber label/`BOOKING_HOLD_HOURS` tetap; modul baru membaca dari sini                          |
| `src/pages/tenant/tenant-bookings/TenantBookingCard.tsx`    | Baris `Diverifikasi`, baris tenggat `Batas pembayaran awal`, panel info tanpa "Booked"         |
| `src/pages/tenant/tenant-bookings/BookingStatusFilters.tsx` | `aria-label` chip Dibatalkan + teks bantuan "Termasuk pesanan kedaluwarsa."                    |
| `src/pages/tenant/tenant-bookings/useTenantBookings.ts`     | Toast batal dibedakan `expired`/`manual`                                                       |
| `src/pages/admin/admin-bookings/BookingTable.tsx`           | Badge Netral, `aria-label` aksi, fallback "Booth dihapus"/"Nama tenant belum diisi", empty row |
| `src/pages/admin/admin-bookings/BookingFilters.tsx`         | Opsi "Dibatalkan (termasuk kedaluwarsa)"                                                       |
| `src/pages/admin/admin-bookings/useAdminBookings.ts`        | Toast batal dan konfirmasi memakai copy kanonik ("terisi")                                     |
| `src/pages/admin/admin-bookings/BookingMetricsCards.tsx`    | Sub-copy "Booth sudah menjadi terisi"                                                          |
| `src/components/map/TenantSidebar.tsx`                      | Label status booth tetap; pastikan memakai `BOOTH_STATUS_LABEL`                                |

Batasan FE-08: tidak mengubah routing, skema/RPC, Zustand, atau DnD. Perubahan
hanya pada copy, pemetaan presentasi, `aria-label`, dan satu empty row tabel.

## 11. Verifikasi dan batasan

- Review statis label di `src/types/booking.ts` dan `src/lib/boothDisplay.ts`
  terhadap PM-04 §3 dan §6: **selesai** (matriks bagian 3 dan 4).
- Tidak ada perubahan kode produksi, database, atau kontrak RPC pada UX-05.
- Verifikasi otomatis: `npm run verify` (dokumentasi saja, tanpa perubahan
  runtime).
- Uji perilaku (EXP-01/EXP-02/EXP-07, BOOK-03..05, ADM-02/03) dan tangkapan
  layar 375/768/1280 px dijalankan pada FE-08 setelah implementasi.
- Verifikasi staging dengan akun nyata tetap menjadi bagian gate rilis QA/REL
  (OPS-04).
