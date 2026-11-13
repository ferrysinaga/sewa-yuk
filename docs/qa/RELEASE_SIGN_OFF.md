# Template Sign-off Rilis (QA-06)

Salin template ini ke PR atau issue rilis, isi hasilnya, lalu lampirkan bukti.
Tujuannya satu: memastikan keputusan **GO / NO-GO / CONDITIONAL** diambil dari
bukti otomatis dan manual yang sama, bukan dari asumsi.

## 1. Identitas rilis

| Field                   | Isi                                       |
| ----------------------- | ----------------------------------------- |
| Tanggal                 |                                           |
| Commit / tag            |                                           |
| Deployment URL          |                                           |
| Environment             | Preview / Staging / Produksi              |
| Migrasi terakhir        | mis. `20261112000100_grant_hardening.sql` |
| QA lead                 |                                           |
| Incident/rollback owner |                                           |

## 2. Gate otomatis (wajib)

| Gate                                                            | Perintah                                                 |                 Wajib                 | Hasil | Bukti |
| --------------------------------------------------------------- | -------------------------------------------------------- | :-----------------------------------: | ----- | ----- |
| Lint + format + typecheck + unit + build + budget + secret scan | `npm run verify`                                         |                  Ya                   |       |       |
| Coverage threshold                                              | `npm run test:coverage`                                  |                Ya (CI)                |       |       |
| Smoke + a11y publik                                             | `npm run test:e2e -- e2e/smoke.spec.ts e2e/a11y.spec.ts` |                  Ya                   |       |       |
| A11y terautentikasi                                             | `npm run test:e2e -- e2e/a11y.spec.ts` dengan `.env.e2e` | Ya bila rilis menyentuh halaman login |       |       |
| SYNC race + expiry                                              | `npm run test:e2e -- e2e/sync.spec.ts` dengan admin env  |  Ya bila menyentuh booking/realtime   |       |       |
| Secret scan                                                     | `npm run security:secrets`                               |      Ya (sudah termasuk verify)       |       |       |
| Audit high/critical                                             | `npm run security:audit`                                 |                  Ya                   |       |       |
| RLS matrix                                                      | `supabase/tests/rls_matrix.sql` di staging               |    Ya untuk perubahan policy/grant    |       |       |
| Query plan                                                      | `supabase/tests/query_plans.sql` di staging              |    Bila ada perubahan index/query     |       |       |

Catatan hasil lokal 13 November 2026:

- `npm run verify`: 29 file / 223 unit test lulus; build 788,74 kB JS dan
  28,77 kB CSS; budget lulus; secret scan bersih.
- `npm run test:coverage`: statements 84,85%, branches 79,19%, functions
  90,25%, lines 84,84%.
- `npx playwright test e2e/smoke.spec.ts e2e/a11y.spec.ts`: 3 lulus
  (A11Y-01, A11Y-02, smoke login), 4 dilewati karena kredensial belum ada.
- SYNC E2E dan RLS staging belum dijalankan (OPS-04).

## 3. Gate manual kritis

Tandai **Lulus / Gagal / Terblokir** dan tautkan ID skenario di
`qa_checklist_test_plan.md`.

| Area                 | Skenario minimum                         | Hasil | Catatan |
| -------------------- | ---------------------------------------- | ----- | ------- |
| Auth & role          | AUTH-01..05, RLS-14, RLS-16              |       |         |
| Landing & event      | LAND-01..02, MAP-01..04                  |       |         |
| Booking              | BOOK-01..09, SYNC-01..04                 |       |         |
| Admin                | DASH-01..02, ADM-01..06                  |       |         |
| Expiry               | EXP-01..08                               |       |         |
| Realtime privacy     | RT-01..04, CONN-01..04                   |       |         |
| RLS/grant            | RLS-01..16, DB-02..06                    |       |         |
| Responsif            | RESP-01..03                              |       |         |
| Error boundary/chunk | ERR-01..04                               |       |         |
| Aksesibilitas        | A11Y-01..06                              |       |         |
| Storage              | IMG-01..05                               |       |         |
| Rollback             | `docs/ops/ROLLBACK.md` tabletop/simulasi |       |         |

## 4. Blocker dan waiver

| ID  | Dampak | Pemilik | Tenggat | Keputusan |
| --- | ------ | ------- | ------- | --------- |
|     |        |         |         |           |

Aturan:

- Blocker keamanan/data (F1/F5, RLS bocor, grant tulis) **tidak boleh**
  di-waiver untuk produksi.
- Waiver hanya untuk isu kosmetik atau non-kritis dengan risiko yang disetujui
  PM dan QA.
- Setiap waiver harus punya pemilik dan tenggat, bukan "nanti".

## 5. Keputusan

| Keputusan       | Arti                                                           |
| --------------- | -------------------------------------------------------------- |
| **GO**          | Semua gate wajib lulus; tidak ada blocker terbuka.             |
| **CONDITIONAL** | Boleh rilis dengan waiver tertulis, pemilik, dan tenggat.      |
| **NO-GO**       | Ada blocker keamanan, data, atau alur kritis yang belum lulus. |

Keputusan: **GO / CONDITIONAL / NO-GO**

Alasan singkat:

```text

```

## 6. Tanda tangan

| Peran       | Nama | Tanggal | Setuju |
| ----------- | ---- | ------- | ------ |
| QA          |      |         |        |
| Frontend    |      |         |        |
| Backend     |      |         |        |
| PM / DevOps |      |         |        |

## 7. Setelah rilis

- Pantau error rate dan log minimal 30 menit.
- Pastikan migrasi tercatat di `supabase/MIGRATIONS.md`.
- Bila rollback terjadi, isi template catatan di `docs/ops/ROLLBACK.md`.
- Perbarui register flaky di `docs/qa/FLAKY_TESTS.md` bila ada tes yang
  menunjukkan gejala tidak konsisten.
