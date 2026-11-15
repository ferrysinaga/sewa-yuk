# Regresi Responsif Peta, Checkout, dan Tabel Admin (QA-04)

Dokumen ini mencatat cakupan regresi responsif pada 375 px, 768 px, dan
1280 px, hasil yang dapat dijalankan tanpa kredensial, serta checklist manual
untuk halaman yang membutuhkan staging.

## 1. Prinsip

- **Halaman publik selalu diuji**: landing dan event explorer tidak membutuhkan
  sesi atau data uji.
- **Halaman terautentikasi di-skip dengan alasan jelas** bila `.env.e2e` atau
  data uji belum tersedia.
- **Tidak ada snapshot baseline lintas OS.** Screenshot dilampirkan ke laporan
  Playwright sebagai bukti visual, bukan dibandingkan piksel demi piksel, karena
  rendering font berbeda antara Windows, Linux, dan CI.
- **Horizontal scroll halaman adalah kegagalan.** Tabel admin boleh memiliki
  scroll horizontal di dalam kontainernya sendiri, tetapi halaman tidak boleh
  ikut melebar.

## 2. Matriks tes

File: `e2e/responsive.spec.ts`. Setiap skenario dijalankan pada tiga viewport:
375×812, 768×1024, dan 1280×900.

| Tes     | Halaman           | Yang diperiksa                                                                       | Syarat                                                   |
| ------- | ----------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| RESP-01 | `/`               | Heading, CTA **Jelajahi acara**, tidak ada overflow halaman, heading tidak terpotong | —                                                        |
| RESP-02 | `/event`          | Heading, kolom pencarian, filter kategori, tidak ada overflow halaman                | —                                                        |
| RESP-03 | `/event/:eventId` | Peta termuat, booth dapat dipilih, tombol booth dan harga terjangkau                 | `E2E_EVENT_ID` + booth `Available`                       |
| RESP-04 | Checkout          | Dialog muat di viewport, tombol Batal dan tombol utama terjangkau, Escape menutup    | `E2E_EVENT_ID` + kredensial tenant A + booth `Available` |
| RESP-05 | `/admin/bookings` | Filter, tabel dengan scroll internal, kolom Aksi, pagination, harga tidak terpotong  | Kredensial organizer                                     |

Asersi kunci:

- `document.documentElement.scrollWidth` dan `document.body.scrollWidth` tidak
  melebihi lebar viewport (+1 px toleransi);
- kontrol utama memiliki bounding box di dalam viewport setelah di-scroll ke
  area yang terlihat;
- teks heading dan harga tidak memiliki `scrollWidth` lebih besar dari
  `clientWidth`;
- tabel admin memakai kontainer `overflow-x: auto|scroll`; pada 375 px dan
  768 px tabel lebih lebar dari kontainernya, lalu kolom **Aksi** tetap dapat
  dijangkau setelah kontainer digeser;
- modal checkout tidak lebih lebar dari viewport dan dapat ditutup dengan
  Escape.

## 3. Hasil otomatis

Eksekusi 15 November 2026 tanpa `.env.e2e`:

```text
npx playwright test e2e/responsive.spec.ts
```

- RESP-01 dan RESP-02 untuk ketiga viewport: **6 lulus**.
- RESP-03, RESP-04, dan RESP-05 untuk ketiga viewport: **9 skip** karena
  `E2E_EVENT_ID`, kredensial tenant A, atau kredensial organizer kosong.
- Tidak ada kegagalan.

| Viewport | RESP-01 | RESP-02 | RESP-03 | RESP-04 | RESP-05 |
| -------- | :-----: | :-----: | :-----: | :-----: | :-----: |
| 375 px   |  lulus  |  lulus  |  skip   |  skip   |  skip   |
| 768 px   |  lulus  |  lulus  |  skip   |  skip   |  skip   |
| 1280 px  |  lulus  |  lulus  |  skip   |  skip   |  skip   |

Setelah staging tersedia, ganti status skip dengan hasil nyata dan lampirkan
output perintah pada PR.

## 4. Checklist manual halaman terautentikasi

Jalankan setelah `.env.e2e`, `E2E_EVENT_ID`, booth `Available`, dan akun staging
tersedia.

### 4.1 Peta dan panel detail (`/event/:eventId`)

- [ ] Pada 375 px, urutan tampilan adalah filter → peta → detail booth; tidak
      ada kontrol yang menutupi peta.
- [ ] Pada 768 px, peta dan panel tetap terbaca; filter tidak terpotong.
- [ ] Pada 1280 px, panel detail berada di kolom kanan dan tetap terlihat saat
      halaman digulir.
- [ ] Booth `Available`, `Reserved`, dan `Booked` dapat dipilih; tombol pesan
      nonaktif untuk booth yang tidak tersedia.
- [ ] Harga, ukuran, dan kategori booth tidak terpotong di ketiga viewport.
- [ ] Fokus keyboard terlihat dan Escape melepas pilihan booth.

### 4.2 Modal checkout

- [ ] Pada 375 px, modal tampil sebagai bottom sheet, tidak melebar ke samping,
      dan tombol utama tetap terlihat setelah konten digulir.
- [ ] Pada 768 px dan 1280 px, modal berada di tengah dengan lebar maksimum
      yang wajar.
- [ ] Pilihan metode pembayaran dapat dioperasikan dengan keyboard dan tidak
      terpotong.
- [ ] Tombol **Batal** dan **Buat Pesanan & Kunci Booth** selalu dapat
      dijangkau; area aman perangkat (`safe-area-inset-bottom`) tidak menutupi
      tombol.
- [ ] Escape menutup modal dan fokus kembali ke tombol pemicu.

### 4.3 Tabel dan filter admin (`/admin/bookings`)

- [ ] Pada 375 px, filter tersusun satu kolom dan tidak terpotong.
- [ ] Tabel dapat digeser horizontal di dalam kontainernya; halaman tidak ikut
      bergeser.
- [ ] Kolom **Aksi** dan tombol **Konfirmasi**/**Batalkan** dapat dijangkau
      setelah tabel digeser.
- [ ] Pagination membungkus dengan rapi dan tombol **Sebelumnya**/
      **Berikutnya** tidak terpotong.
- [ ] Harga, kode booking, dan status tidak terpotong; nama tenant/event yang
      panjang boleh terpotong dengan elipsis karena memang disengaja.
- [ ] Konfirmasi inline dapat dibuka, ditutup dengan Escape, dan fokus kembali
      ke tombol pemicu.

## 5. Bukti screenshot

Setiap tes melampirkan screenshot ke laporan Playwright:

```bash
npx playwright test e2e/responsive.spec.ts --reporter=html
npx playwright show-report
```

Buka hasil tes, unduh lampiran `landing-375px`, `event-explorer-768px`,
`checkout-375px`, `admin-bookings-1280px`, dan seterusnya, lalu lampirkan ke PR.

Untuk perubahan UI:

1. Jalankan suite pada commit sebelum perubahan dan simpan screenshot sebagai
   **before**.
2. Jalankan lagi pada commit perubahan dan simpan sebagai **after**.
3. Lampirkan pasangan before/after untuk viewport yang terpengaruh.

QA-04 tidak mengubah kode UI, sehingga screenshot before/after identik; yang
dilampirkan adalah bukti eksekusi suite.

## 6. Batasan

- RESP-03, RESP-04, dan RESP-05 belum dieksekusi karena tidak ada kredensial,
  `E2E_EVENT_ID`, atau data staging di mesin ini (OPS-04).
- Suite ini tidak membandingkan piksel; regresi visual halus tetap perlu
  ditinjau manual dari screenshot.
- Pengujian perangkat fisik (iOS Safari/Android Chrome) dan zoom 200% tetap
  manual; lihat juga checklist di `docs/qa/A11Y_AUDIT.md`.

## 7. Referensi

- `e2e/responsive.spec.ts`
- `e2e/fixtures.ts`
- `.env.e2e.example`
- `qa_checklist_test_plan.md` (TS-18)
- `docs/qa/A11Y_AUDIT.md`
- `docs/qa/FLAKY_TESTS.md`
