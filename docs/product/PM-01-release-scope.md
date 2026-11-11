# PM-01 — Ruang Lingkup dan Non-Goal Rilis Berikutnya

| Atribut       | Keterangan                                       |
| ------------- | ------------------------------------------------ |
| Nama rilis    | **Rilis Keandalan Pemesanan**                    |
| Versi kerja   | `v1.1.0` (kandidat)                              |
| Pemilik       | Product Manager                                  |
| Status        | Siap direview; sign-off lintas role masih manual |
| Tanggal       | 11 November 2026                                 |
| Acuan backlog | `NEXT_TASKS.txt`                                 |

## 1. Masalah yang diselesaikan

Rilis ini berfokus pada **kepercayaan pengguna terhadap proses pemesanan**,
bukan penambahan fitur baru. Tiga masalah utama:

1. **Risiko data**: dua tenant masih dapat berpotensi memesan booth yang sama
   bila terjadi race condition atau perubahan status manual. UI dan RPC sudah
   mencegah, tetapi database belum punya jaminan terakhir.
2. **Kegagalan yang tidak informatif**: error RPC, chunk lazy yang gagal, dan
   koneksi realtime yang putus berisiko menghasilkan layar putih atau pesan
   mentah yang tidak dapat ditindaklanjuti pengguna.
3. **Kesiapan operasi**: belum ada gerbang rilis, rollback runbook, dan
   pemeriksaan keamanan yang konsisten sebelum deploy.

Pengguna terdampak: tenant (pemesan booth), organizer (verifikator dan pemilik
denah), serta tim operasi yang harus memulihkan layanan bila deploy bermasalah.

## 2. Outcome rilis (maksimal 5)

| #   | Outcome                                    | Ukuran keberhasilan                                                                                                 |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| O1  | **Pemesanan tidak dobel dan aman diulang** | Uji race dua tenant hanya menghasilkan satu booking; retry RPC tidak menggandakan data; error dipetakan ke pesan UI |
| O2  | **Kegagalan UI dapat dipulihkan**          | Error boundary menampilkan fallback, bukan layar putih; perubahan saat offline tersinkron setelah reconnect         |
| O3  | **Akses data terverifikasi aman**          | Negative test RLS/otorisasi ditolak 100%; payload realtime tidak membocorkan booking tenant lain                    |
| O4  | **Operasi rilis siap**                     | Branch protection aktif; secret scanning dan audit dependensi berjalan; rollback runbook diuji                      |
| O5  | **Gerbang rilis dan UAT disepakati**       | PM-02 selesai; REL-01 ditandatangani PM, QA, DevOps; tidak ada bug Critical/Major terbuka                           |

## 3. Ruang lingkup

### O1 — Integritas booking

| Task                                  | Pemilik | Prioritas | Dependensi | Acceptance criteria (ringkas)                                                       |
| ------------------------------------- | ------- | --------- | ---------- | ----------------------------------------------------------------------------------- |
| BE-02 Jaminan database double booking | Backend | P1        | BE-03      | Unique index aktif; preflight duplikat; booth yatim direkonsiliasi                  |
| BE-03 Idempotensi + kontrak error RPC | Backend | P1        | —          | Retry tidak menggandakan; hint `SWY_*` stabil; `search_path` aman                   |
| QA-01 E2E race condition dan expiry   | QA      | P1        | BE-02      | Hanya satu pemenang; booth kembali `Available` setelah expiry; data uji dibersihkan |

### O2 — Ketahanan UI

| Task                                           | Pemilik  | Prioritas | Dependensi   | Acceptance criteria (ringkas)                                                                   |
| ---------------------------------------------- | -------- | --------- | ------------ | ----------------------------------------------------------------------------------------------- |
| FE-01 Error boundary global + chunk recovery   | Frontend | P1        | UX-02        | Fallback keyboard-friendly; chunk gagal tidak reload berulang                                   |
| FE-02 Realtime reconnect + rollback optimistic | Frontend | P1        | BE-04, UX-02 | Perubahan offline tersinkron; tidak ada status “kembali” tanpa rollback; tidak ada channel leak |

### O3 — Keamanan akses data

| Task                                  | Pemilik | Prioritas | Dependensi | Acceptance criteria (ringkas)                                |
| ------------------------------------- | ------- | --------- | ---------- | ------------------------------------------------------------ |
| BE-01 Audit matriks RLS               | Backend | P1        | —          | Setiap operasi punya policy yang disengaja dan teruji        |
| BE-04 Audit privasi realtime          | Backend | P1        | BE-01      | Tenant hanya menerima event booking miliknya                 |
| QA-03 Suite negatif otorisasi dan RLS | QA      | P1        | BE-01      | Semua akses tidak sah ditolak; tidak ada data sensitif bocor |

### O4 — Kesiapan operasi

| Task                                         | Pemilik | Prioritas | Dependensi | Acceptance criteria (ringkas)                               |
| -------------------------------------------- | ------- | --------- | ---------- | ----------------------------------------------------------- |
| OPS-01 Branch protection + required checks   | DevOps  | P1        | —          | PR dengan gate gagal tidak dapat di-merge                   |
| OPS-02 Secret scanning + audit dependensi    | DevOps  | P1        | —          | Tidak ada secret di repo/log/bundle; temuan punya pemilik   |
| BE-06 Rollback migrasi, backup, review index | Backend | P2        | —          | Urutan migrasi dan rollback terdokumentasi (enabler OPS-03) |
| OPS-03 Runbook rollback                      | DevOps  | P1        | BE-06      | Rollback teruji dalam hitungan menit; data tidak hilang     |
| OPS-04 Preview environment + data uji        | DevOps  | P1        | BE-01      | QA dapat menjalankan E2E berautentikasi tanpa data produksi |

### O5 — Gerbang rilis dan UAT

| Task                                     | Pemilik               | Prioritas | Dependensi                                               | Acceptance criteria (ringkas)                                                 |
| ---------------------------------------- | --------------------- | --------- | -------------------------------------------------------- | ----------------------------------------------------------------------------- |
| PM-02 Acceptance criteria + skenario UAT | Product               | P1        | PM-01                                                    | QA dapat menentukan lulus/tidak lulus tanpa menebak                           |
| PM-03 Metrik funnel dan baseline         | Product               | P1        | PM-01                                                    | 5–7 metrik punya definisi, sumber, pemilik, dan query yang dapat direproduksi |
| PM-04 Tinjau kebijakan expiry/copy       | Product               | P2        | PM-02                                                    | Review selesai; temuan copy menjadi follow-up, bukan gate rilis               |
| REL-01 Release readiness checklist       | Product + QA + DevOps | P1        | PM-01, PM-02, FE-01, FE-02, BE-02, QA-01, OPS-02, OPS-03 | Semua gate lulus atau risiko diterima tertulis; release note + rollback siap  |

> PM-03 dan PM-04 disertakan sebagai **pendukung keputusan**, bukan gate rilis.
> Baseline PM-03 boleh diisi dari environment uji selama belum ada data
> produksi; temuan copy PM-04 dikerjakan pada siklus UI berikutnya.

## 4. Non-goal (sengaja ditunda)

| Task / area                                       | Alasan ditunda                                                 | Sasaran berikutnya           |
| ------------------------------------------------- | -------------------------------------------------------------- | ---------------------------- |
| FE-03 Panel detail + checkout mobile sesuai UX-01 | Perubahan UI besar; rilis ini fokus keandalan                  | Rilis Mobile & Aksesibilitas |
| FE-04 Regression test keyboard dan fokus          | Bergantung FE-03                                               | Rilis Mobile & Aksesibilitas |
| UX-04 Audit token, radius, tipografi, copy        | P2; tidak memblokir keandalan                                  | Rilis Mobile & Aksesibilitas |
| QA-02 Audit a11y halaman terautentikasi           | Bergantung OPS-04 dan perubahan FE-03                          | Rilis Mobile & Aksesibilitas |
| QA-04 Regresi responsif peta/checkout/tabel       | Bergantung FE-03                                               | Rilis Mobile & Aksesibilitas |
| BE-05 Validasi storage + file yatim               | P2; tidak ada insiden produksi yang dilaporkan                 | Siklus kualitas berikutnya   |
| OPS-05 Monitoring error + notifikasi deploy       | P2; dapat menyusul setelah gerbang dasar                       | Siklus operasi berikutnya    |
| OPS-06 Uji backup/restore + versi runtime         | P2; menunggu runbook OPS-03                                    | Siklus operasi berikutnya    |
| PM-05 Release note dan komunikasi                 | Bergantung REL-01; dikerjakan **setelah** gate lulus           | Pasca-rilis                  |
| FE-05 Budget bundle, FE-06 unit test error/expiry | P2; bukan risiko rilis saat ini                                | Siklus kualitas berikutnya   |
| QA-05 Flaky test, QA-06 Template sign-off         | P2; REL-01 memakai checklist sementara                         | Siklus QA berikutnya         |
| Analytics/tracking baru                           | Belum ada kebutuhan yang terbukti; PM-03 memakai data yang ada | Menunggu baseline            |

## 5. Kriteria sukses rilis

Rilis dinyatakan siap bila seluruh kondisi berikut terpenuhi:

1. **Data integrity**: uji race dua tenant (QA-01/SYNC-03) menghasilkan tepat
   satu booking; tidak ada booking aktif ganda pada query preflight; tidak ada
   booth `Reserved`/`Booked` tanpa booking aktif.
2. **Error contract**: seluruh hint `SWY_*` dan fallback SQLSTATE dipetakan ke
   pesan pengguna; tidak ada pesan mentah PostgreSQL yang tampil.
3. **Keamanan**: seluruh skenario QA-03 ditolak; tidak ada data tenant lain di
   payload realtime tenant.
4. **Pemulihan UI**: error boundary teruji; reconnect realtime menyinkronkan
   perubahan yang terlewat tanpa reload manual.
5. **Kualitas otomatis**: `npm run verify` lulus; smoke test lulus; a11y dan
   sync dijalankan di environment yang tersedia atau alasan skip dicatat.
6. **Operasi**: branch protection aktif; secret scanning bersih; rollback
   runbook diuji; preview environment dapat dipakai QA.
7. **Gerbang rilis**: REL-01 ditandatangani PM, QA, dan DevOps; tidak ada bug
   Critical/Major terbuka tanpa keputusan risiko tertulis.

## 6. Risiko dan ketergantungan lintas role

| Risiko                                                 | Dampak                                                     | Mitigasi                                              | Pemilik          |
| ------------------------------------------------------ | ---------------------------------------------------------- | ----------------------------------------------------- | ---------------- |
| `.env.e2e` dan environment QA belum tersedia           | QA-01/QA-02 tidak dapat dijalankan; race test hanya manual | OPS-04 menyediakan preview + seed + akun uji          | DevOps + QA      |
| Migrasi BE-02/BE-03 belum dieksekusi di Postgres nyata | Jaminan double booking belum terbukti                      | Jalankan migrasi 8–9 di staging, lalu QA DB-01/EXP-08 | Backend + QA     |
| BE-04 bergantung BE-01                                 | Privasi realtime tidak terverifikasi bila BE-01 slip       | Kerjakan BE-01 lebih dulu; QA-03 menyusul             | Backend          |
| OPS-03 bergantung BE-06                                | Rollback runbook tidak dapat diuji                         | BE-06 masuk scope sebagai enabler                     | Backend + DevOps |
| Branch protection butuh akses admin repo               | Gate CI tidak menahan merge                                | OPS-01 dikerjakan bersama pemilik repo                | DevOps + PM      |
| Perubahan status booth manual                          | Booth tertahan atau status tidak konsisten                 | Rekonsiliasi BE-02 + sweep expiry                     | Backend          |

## 7. Review dan sign-off

Dokumen ini menjadi acuan eksekusi setelah direview. Sign-off dicatat di PR
atau issue rilis.

| Role            | Fokus review                                   | Status                |
| --------------- | ---------------------------------------------- | --------------------- |
| Product Manager | Scope, non-goal, kriteria sukses               | Selesai (dokumen ini) |
| UI/UX           | Dampak ke panel/checkout dan copy              | Menunggu              |
| Frontend        | Kelayakan FE-01/FE-02 dan dependensi UX-02     | Menunggu              |
| Backend         | Kelayakan BE-01/BE-04/BE-06 dan urutan migrasi | Menunggu              |
| QA              | Keterujian acceptance criteria dan UAT         | Menunggu              |
| DevOps          | OPS-01..04, rollback, dan environment          | Menunggu              |

## 8. Tautan

- Backlog dan status: `NEXT_TASKS.txt`
- Rencana UAT: `docs/product/PM-02-uat-critical-flows.md` (dibuat pada PM-02)
- Metrik: `docs/product/PM-03-funnel-metrics.md` (dibuat pada PM-03)
- Tinjauan expiry/copy: `docs/product/PM-04-expiry-cancellation-policy.md`
  (dibuat pada PM-04)
- Kontrak error RPC: `supabase/ERROR_CONTRACT.md`
- Jaminan double booking: `supabase/DOUBLE_BOOKING.md`
- Test plan: `qa_checklist_test_plan.md`
- Spesifikasi UX: `job-desk/specs/UX-01-panel-detail-checkout.md`,
  `job-desk/specs/UX-02-error-boundary-offline-reconnect.md`,
  `job-desk/specs/UX-03-canvas-accessibility-audit.md`

## 9. Decision log

| #   | Keputusan                                               | Alasan                                                            |
| --- | ------------------------------------------------------- | ----------------------------------------------------------------- |
| D1  | Rilis ini bertema keandalan pemesanan, bukan fitur baru | Risiko data dan kepercayaan pengguna lebih mendesak               |
| D2  | FE-03/FE-04 dan audit a11y ditunda                      | Perubahan UI besar butuh siklus dan pengujian responsif sendiri   |
| D3  | BE-01/BE-04/QA-03 masuk scope                           | Keamanan akses data adalah bagian dari kepercayaan pemesanan      |
| D4  | BE-06 (P2) dinaikkan ke scope sebagai enabler OPS-03    | Rollback runbook wajib ada sebelum deploy berisiko                |
| D5  | PM-03 tidak menjadi gate rilis                          | Metrik berguna untuk keputusan berikutnya, bukan syarat deploy    |
| D6  | PM-05 dikerjakan setelah REL-01                         | Release note tidak boleh mengklaim fitur yang belum terverifikasi |
