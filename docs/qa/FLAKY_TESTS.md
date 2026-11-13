# Flaky Test Register dan Anggaran Pipeline (QA-05)

Dokumen ini adalah hasil **QA-05**. Tujuannya menjaga kepercayaan pipeline:
tes yang gagal tidak konsisten harus dicatat, diperbaiki akar masalahnya, dan
tidak ditutupi dengan retry tanpa batas. Dokumen juga mencatat hasil pengukuran
durasi suite unit test setelah optimasi environment Vitest.

## 1. Kebijakan retry

- **Default tidak ada retry.** Vitest berjalan sekali, Playwright memakai
  `retries: 0`, dan CI menjalankan setiap langkah satu kali.
- Retry sementara hanya boleh ditambahkan bila:
  1. ada baris di register bagian 3;
  2. ada issue/task tertaut dengan pemilik dan tanggal kedaluwarsa;
  3. retry dibatasi maksimal 1 dan dihapus setelah akar masalah diperbaiki.
- Jangan menaikkan `workers`, `fullyParallel`, atau timeout sebagai solusi
  pertama. Perbaiki timing, selector, data, atau setup/teardown.
- Tes yang belum dapat distabilkan karena lingkungan (misalnya butuh staging)
  harus **di-skip dengan alasan eksplisit**, bukan dibiarkan gagal acak.

Konfigurasi saat ini:

| Runner     | Retry | Paralelisme                          | Catatan                                     |
| ---------- | ----- | ------------------------------------ | ------------------------------------------- |
| Vitest     | 0     | default worker Vitest                | `restoreMocks: true`, cleanup DOM per tes   |
| Playwright | 0     | `workers: 1`, `fullyParallel: false` | Dua context untuk skenario realtime         |
| CI         | 0     | satu job `verify`                    | `timeout-minutes: 20`, `cancel-in-progress` |

## 2. Perubahan environment Vitest

Sebelum QA-05, Vitest membuat environment jsdom untuk setiap file (29 kali).
Warning runtime menyarankan satu environment per worker. Konfigurasi
`vite.config.ts` sekarang memakai:

```ts
test: {
  environment: 'jsdom',
  pool: 'vmThreads',
  // ...
}
```

`vmThreads` tetap mengisolasi modul per file, tetapi membuat jsdom sekali per
worker. Tidak ada tes yang diubah dan tidak ada dependensi baru.

### 2.1 Hasil 10 run berturut-turut

Lokal Windows, Node 22, `npm test`:

| Run | Hasil         | Durasi |
| --- | ------------- | ------ |
| 1   | 223/223 lulus | 7.37 s |
| 2   | 223/223 lulus | 6.74 s |
| 3   | 223/223 lulus | 7.50 s |
| 4   | 223/223 lulus | 7.83 s |
| 5   | 223/223 lulus | 6.42 s |
| 6   | 223/223 lulus | 6.31 s |
| 7   | 223/223 lulus | 5.89 s |
| 8   | 223/223 lulus | 5.93 s |
| 9   | 223/223 lulus | 5.99 s |
| 10  | 223/223 lulus | 6.29 s |

Rata-rata 10 run: **6.63 s**, rentang 5.89–7.83 s, tanpa kegagalan.

Baseline sebelum perubahan (tiga run): 11.03 s, 12.99 s, 12.16 s; rata-rata
**12.06 s**. Perbaikan sekitar **45%** pada langkah unit test. Persentase waktu
environment turun dari 77% menjadi sekitar 65–71%.

Angka ini adalah pengukuran lokal, bukan CI. Setelah perubahan masuk, catat
durasi langkah `Unit test with coverage` di GitHub Actions untuk memastikan
perbaikan terbawa.

## 3. Register flaky test

Status per QA-05:

| Tes / area                     | Gejala yang pernah berisiko                              | Akar masalah / mitigasi                                                           | Status                   |
| ------------------------------ | -------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------ |
| SYNC-01/02/03 (`sync.spec.ts`) | Menunggu Realtime dan cleanup booth bisa saling mengunci | Wait eksplisit pada atribut/heading; cleanup service role; fallback pembatalan UI | Dimonitor; butuh staging |
| SYNC-04 (`sync.spec.ts`)       | Sweep expiry bergantung waktu dan data sisa              | `expires_at` dimajukan lewat service role; reset booth; asersi UI + database      | Baru; butuh staging      |
| A11Y-03..06 (`a11y.spec.ts`)   | Halaman terautentikasi butuh kredensial/data             | Skip dengan alasan variabel yang kurang; tidak ada retry                          | Menunggu staging         |
| Unit test React/DOM            | Potensi kebocoran DOM antar-file                         | `cleanup()` setelah setiap tes, `restoreMocks: true`, isolasi modul `vmThreads`   | 10/10 run lulus          |
| Build/bundle budget            | Tidak flaky; gagal deterministik bila budget terlampaui  | Ambang eksplisit di `scripts/check-bundle-budget.mjs`                             | Stabil                   |

Tidak ada tes yang saat ini memakai retry. Bila muncul kegagalan acak, tambahkan
baris baru dengan format:

```md
| Nama tes | Gejala + run yang gagal | Akar masalah | Perbaikan / issue | Status |
```

## 4. Prosedur triase flaky test

1. Reproduksi tanpa retry:
   - unit: `npx vitest run <file> --repeat=5`;
   - E2E: `npx playwright test <file> --repeat-each=5 --workers=1`.
2. Baca trace/screenshot Playwright dan log console. Cari race pada data,
   bukan sekadar menambah `waitForTimeout`.
3. Perbaiki salah satu dari:
   - selector yang terlalu umum;
   - asersi sebelum state database/UI selesai;
   - data uji yang dipakai bersama tanpa cleanup;
   - cleanup yang bergantung pada UI ketika admin API tersedia.
4. Jalankan ulang 10 kali. Baru tutup baris register bila 10/10 lulus.
5. Bila akar masalah ada di staging dan belum dapat diperbaiki, skip dengan
   alasan eksplisit dan catat sebagai risiko rilis.

## 5. Anggaran durasi pipeline

- Job CI `verify` memiliki `timeout-minutes: 20`.
- Anggaran pemantauan QA-05: **≤ 15 menit** untuk job `verify` (di luar waktu
  antrean). Bila dua run berturut-turut melewati 15 menit, buka task optimasi
  dengan data langkah terbesar.
- Langkah yang biasanya mendominasi: `npm ci`, instalasi Chromium Playwright,
  dan `test:coverage`. Optimasi berikutnya harus diukur, bukan diasumsikan.
- `test:coverage` tetap dijalankan di CI karena ambang cakupan adalah gate.
  `npm test` lokal tidak memakai coverage agar umpan balik cepat.

## 6. Batasan

- E2E SYNC dan A11Y terautentikasi belum dijalankan karena `.env.e2e` dan
  kredensial staging belum tersedia (OPS-04). Register di atas karena itu
  berisi kandidat dan mitigasi, bukan bukti 10 run E2E.
- Pengukuran 10 run dilakukan di Windows lokal. CI Ubuntu dapat memiliki angka
  berbeda; arah perbaikan (satu jsdom per worker) tetap berlaku.
- QA-02/QA-03/QA-04 masih memblokir verifikasi aksesibilitas, RLS, dan
  responsif nyata di staging.

## 7. Referensi

- `vite.config.ts` (pool Vitest)
- `playwright.config.ts` (`retries: 0`, workers, timeout)
- `e2e/sync.spec.ts` dan `e2e/fixtures.ts` (setup/teardown SYNC)
- `.github/workflows/ci.yml` (urutan langkah dan timeout)
- `qa_checklist_test_plan.md` (skenario manual dan otomatis)
