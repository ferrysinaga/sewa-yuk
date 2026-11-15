# Audit Aksesibilitas Halaman Publik dan Terautentikasi (QA-02)

Dokumen ini mencatat cakupan audit aksesibilitas, hasil otomatis yang dapat
dijalankan tanpa kredensial, dan checklist manual untuk halaman yang baru dapat
diaudit setelah OPS-04 menyediakan akun serta data staging.

## 1. Cakupan

| Route             | Halaman             | Data/kredensial yang dibutuhkan | Tes otomatis     |
| ----------------- | ------------------- | ------------------------------- | ---------------- |
| `/`               | Landing             | —                               | A11Y-01, A11Y-07 |
| `/event`          | Event explorer      | —                               | A11Y-02, A11Y-08 |
| `/event/:eventId` | Detail event        | `E2E_EVENT_ID`                  | A11Y-03, A11Y-09 |
| `/admin`          | Dashboard organizer | `E2E_ORGANIZER_EMAIL/PASSWORD`  | A11Y-04          |
| `/admin/bookings` | Pemesanan organizer | `E2E_ORGANIZER_EMAIL/PASSWORD`  | A11Y-05          |
| `/bookings`       | Pesanan tenant      | `E2E_TENANT_A_EMAIL/PASSWORD`   | A11Y-06          |

Semua tes memakai axe-core dengan tag `wcag2a`, `wcag2aa`, `wcag21a`, dan
`wcag21aa`. Tes yang tidak dapat dijalankan **di-skip dengan alasan variabel
yang kurang**, bukan dibiarkan gagal acak.

## 2. Hasil otomatis

Per 15 November 2026, tanpa `.env.e2e`:

```text
npx playwright test e2e/a11y.spec.ts
```

- A11Y-01, A11Y-02, A11Y-07, A11Y-08: **lulus**.
- A11Y-03, A11Y-09: **skip** karena `E2E_EVENT_ID` kosong.
- A11Y-04, A11Y-05: **skip** karena kredensial organizer kosong.
- A11Y-06: **skip** karena kredensial tenant A kosong.

Tes keyboard yang berjalan tanpa kredensial:

- skip link harus menjadi fokus pertama saat Tab, terlihat, dan memindahkan
  fokus ke `<main id="main">`;
- pada detail event, booth dapat dipilih dengan Enter, ditandai
  `aria-current="true"`, dan dilepas dengan Escape.

## 3. Checklist manual halaman terautentikasi

Jalankan setelah `.env.e2e` dan data staging tersedia.

### 3.1 Keyboard dan fokus

- [ ] Tab dari awal halaman menampilkan skip link, lalu Enter memindahkan fokus
      ke konten utama.
- [ ] Urutan fokus mengikuti urutan visual pada `/admin`, `/admin/bookings`,
      `/bookings`, dan `/event/:eventId`.
- [ ] Fokus selalu terlihat (ring pine/clay) pada latar terang dan tombol
      berwarna.
- [ ] Modal checkout: fokus masuk ke dialog, Tab berputar di dalam dialog,
      Escape menutup, dan fokus kembali ke tombol pemicu.
- [ ] Panel konfirmasi inline: fokus pindah ke tombol Batal, Escape menutup,
      dan fokus kembali ke pemicu.
- [ ] Peta: setelah area peta difokuskan, tombol panah menggeser tampilan;
      Enter/Space memilih booth; Escape melepas pilihan.

### 3.2 Kontras, label, dan teks

- [ ] Tidak ada teks abu-abu di atas latar canvas/surface yang gagal kontras
      AA (axe sudah memeriksa, tetapi cek juga status dinamis).
- [ ] Status booth tidak hanya dibedakan lewat warna; label teks/ikon tetap
      ada.
- [ ] Semua input punya label yang terhubung; placeholder bukan satu-satunya
      label.
- [ ] Tombol ikon punya `aria-label` yang menjelaskan aksi.
- [ ] Pesan error dan toast terbaca oleh pembaca layar (`role="alert"` atau
      `aria-live`).

### 3.3 Target sentuh dan zoom

- [ ] Pada 375 px, tombol utama, filter, dan kontrol peta memiliki target
      minimal 44×44 px atau area klik yang setara.
- [ ] Halaman dapat di-zoom 200% tanpa kehilangan kontrol utama.
- [ ] Tidak ada kontrol yang hanya muncul saat hover.

## 4. Cara menjalankan

```bash
# Publik + keyboard
npx playwright test e2e/a11y.spec.ts

# Dengan staging
cp .env.e2e.example .env.e2e
# isi kredensial, E2E_EVENT_ID, dan booth Available
npx playwright test e2e/a11y.spec.ts
```

Untuk audit manual, gunakan Chrome DevTools Lighthouse/Axe DevTools dan
pembaca layar (NVDA/VoiceOver) pada route yang sama.

## 5. Batasan

- A11Y-03..06 dan A11Y-09 belum dieksekusi karena tidak ada kredensial/data
  staging di mesin ini (OPS-04).
- Axe tidak menggantikan uji keyboard dan pembaca layar; checklist bagian 3
  tetap wajib.
- Audit ini tidak menguji halaman error boundary/chunk secara otomatis; lihat
  ERR-01..04 di `qa_checklist_test_plan.md`.

## 6. Referensi

- `e2e/a11y.spec.ts`
- `.env.e2e.example`
- `qa_checklist_test_plan.md` (TS-17)
- `docs/qa/RELEASE_SIGN_OFF.md`
