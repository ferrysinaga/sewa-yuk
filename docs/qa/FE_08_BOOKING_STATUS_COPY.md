# FE-08 — Implementasi Copy dan Presentasi Status Booking

Dokumen ini mencatat implementasi spesifikasi UX-05 pada UI tenant dan admin.
Perubahan hanya menyentuh copy, pemetaan presentasi, `aria-label`, dan empty
state. Routing, skema/RPC Supabase, Zustand, dan DnD tidak berubah.

| Atribut     | Keterangan                                                                         |
| ----------- | ---------------------------------------------------------------------------------- |
| Pemilik     | Frontend Developer                                                                 |
| Kolaborator | UI/UX Designer, QA                                                                 |
| Acuan       | `docs/product/UX-05-booking-status-copy.md`, `PM-04-expiry-cancellation-policy.md` |
| Tanggal     | 16 November 2026                                                                   |

## 1. Perubahan

### Satu sumber presentasi

`src/lib/bookingStatus.ts` menjadi view model status booking:

- `getBookingStatusView(booking, now)` mengembalikan label, badge/dot, deskripsi,
  aturan tenggat (`showDeadline`, `deadlineLabel`, `deadlineTone`), mode countdown
  (`remaining`/`expired`/`none`), dan aksi yang tersedia (`canCancel`,
  `canMarkPaid`, `canConfirm`).
- Copy toast: `MARK_PAID_TOAST`, `getCancelBookingToast`, `getConfirmBookingToast`,
  `getExpiredSweepToast`.
- `describeRemainingTime` menghasilkan kalimat lengkap untuk `aria-label`.

### Temuan PM-04

| Temuan | Perubahan                                                                                                           |
| ------ | ------------------------------------------------------------------------------------------------------------------- |
| F-01   | Baris `paid_at` pada kartu tenant memakai label **Diverifikasi**, bukan **Dibayar**.                                |
| F-02   | `awaiting_confirmation` memakai label **Batas pembayaran awal**, tanpa countdown, plus catatan batas tidak berlaku. |
| F-03   | Toast pembatalan tenant dan admin membaca `cancelled_reason` dan membedakan `expired` vs `manual`.                  |
| F-04   | Nilai 24 jam tetap satu sumber (`BOOKING_HOLD_HOURS`) dan dipakai checkout; tidak ada literal baru di komponen.     |

### Perubahan visual dan copy lain

- **CH-01**: tone `awaiting_confirmation` menjadi `bg-canvas text-ink ring-line`
  (netral) agar tidak terbaca seperti status selesai.
- Countdown memakai `role="timer"`, `aria-live="off"`, dan `aria-label`
  "Sisa waktu pembayaran …" yang berubah per menit.
- Dot badge memakai `aria-hidden="true"`; status selalu punya teks.
- Tabel admin: tombol konfirmasi/batal memakai `aria-label` berisi kode pesanan;
  fallback "Nama tenant belum diisi" dan "Booth dihapus".
- Filter status admin: opsi "Dibatalkan (termasuk kedaluwarsa)".
- Filter tenant: chip Dibatalkan menjelaskan cakupan kedaluwarsa lewat teks
  tersembunyi, plus teks bantuan "Termasuk pesanan kedaluwarsa." di bawah filter.
- Empty state admin diselaraskan: "Belum ada pesanan" / "Tidak ada pesanan pada
  filter ini".
- Istilah "Booked" pada copy diganti "terisi" (metrik, toast, footer halaman).

## 2. Bukti tangkapan layar

Semua gambar ada di `docs/qa/screenshots/fe-08/`. Halaman terautentikasi diambil
dengan sesi + REST mock lokal (skrip sementara, tidak di-commit).

| Halaman / komponen        | 375 px                    | 1280 px                    |
| ------------------------- | ------------------------- | -------------------------- |
| `/bookings` (tenant)      | `tenant-bookings-375.png` | `tenant-bookings-1280.png` |
| Kartu pending (tenant)    | `card-pending-375.png`    | —                          |
| Kartu menunggu verifikasi | `card-awaiting-375.png`   | —                          |
| `/admin/bookings`         | `admin-bookings-375.png`  | `admin-bookings-1280.png`  |

Hasil pengukuran dari mock:

```text
/bookings       375: scrollWidth 375 / clientWidth 375, timer aria-label "Sisa waktu pembayaran 5 jam"
/bookings      1280: scrollWidth 1280 / clientWidth 1280
/admin/bookings 375: scrollWidth 375 / clientWidth 375 (tabel memakai scroll internal)
/admin/bookings 1280: scrollWidth 1280 / clientWidth 1280
```

Badge yang terlihat di `/bookings`: Menunggu Pembayaran, Menunggu Verifikasi,
Terkonfirmasi, Dibatalkan, Kedaluwarsa. Di `/admin/bookings` kelima status juga
tampil, dengan `aria-label` aksi "Konfirmasi pembayaran SWY-…" dan "Batalkan
pesanan SWY-…".

## 3. Verifikasi

- `npm run verify` — lulus (lint, format, typecheck, 242 unit test, build,
  budget bundle 791,73 kB / 850 kB, secret scan).
- `npm run test:e2e -- e2e/smoke.spec.ts e2e/a11y.spec.ts e2e/responsive.spec.ts`
  — **11 lulus, 14 skip, 0 gagal**.
  - Skip dengan alasan eksplisit: A11Y-03/04/05/06/09 dan RESP-03/04/05
    membutuhkan `.env.e2e`, `E2E_EVENT_ID`, atau kredensial staging (OPS-04).
- Audit axe pada halaman terautentikasi via mock: **0 pelanggaran**
  (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) untuk `/bookings` dan
  `/admin/bookings` pada 375 px dan 1280 px.
- Pelanggaran axe yang sempat muncul saat pengembangan sudah diperbaiki:
  - `definition-list`/`dlitem`: catatan batas pembayaran dipindah ke dalam `<dd>`
    agar `<div>` di dalam `<dl>` hanya berisi `dt`/`dd`.
  - `label-content-name-mismatch`: `aria-label` chip filter diganti teks
    tersembunyi agar nama aksesibel tetap memuat label yang terlihat.

## 4. Batasan

- Verifikasi staging dengan akun nyata (A11Y-04/05/06, RESP-03/04/05) belum
  dijalankan karena `.env.e2e` dan kredensial belum tersedia.
- Mock REST hanya untuk audit lokal; bukan pengganti UAT. Hasil mock tidak
  membuktikan RLS atau perilaku realtime.
- Uji perilaku EXP-01/EXP-02/EXP-07, BOOK-03..05, dan ADM-02/03 tetap menjadi
  bagian gate rilis QA/REL.
