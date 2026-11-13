# REL-01 — Release Readiness Checklist

| Atribut        | Keterangan                                                          |
| -------------- | ------------------------------------------------------------------- |
| Rilis          | **Rilis Keandalan Pemesanan** (`v1.1.0` kandidat)                   |
| Acuan scope    | `docs/product/PM-01-release-scope.md`                               |
| Pemilik gate   | Product Manager + QA Engineer + DevOps Engineer                     |
| Status         | **NO-GO sementara** — gate otomatis lokal lulus, gate staging belum |
| Tanggal review | 13 November 2026                                                    |
| Keputusan      | **NO-GO** sampai blocker bagian 6 ditutup atau di-waiver tertulis   |

Dokumen ini adalah checklist tunggal untuk memutuskan apakah rilis boleh
berjalan. Isi setiap baris dengan **Lulus / Gagal / Terblokir** dan tautkan
bukti. Jangan menandai **GO** bila masih ada baris **Terblokir** pada gate
wajib.

## 1. Identitas dan ruang lingkup

- [x] PM-01 selesai: ruang lingkup, non-goal, dan kriteria sukses disetujui.
- [x] PM-02 selesai: acceptance criteria dan skenario UAT tersedia.
- [x] Non-goal tidak berubah tanpa keputusan PM tertulis.
- [x] Daftar migrasi yang ikut rilis diketahui (lihat
      `supabase/MIGRATIONS.md`).
- [ ] Commit/tag dan deployment URL rilis diisi di PR/issue.
- [ ] Release note tersedia (PM-05).

Catatan: PM-05 sengaja belum dikerjakan karena bergantung pada gate ini. Ini
adalah blocker rilis, bukan pekerjaan yang boleh dilewati.

## 2. Gate otomatis

| Gate                    | Perintah                                                 | Status        | Bukti                                                              |
| ----------------------- | -------------------------------------------------------- | ------------- | ------------------------------------------------------------------ |
| Lint, format, typecheck | `npm run verify`                                         | **Lulus**     | 13 Nov 2026, tanpa error                                           |
| Unit test               | `npm test`                                               | **Lulus**     | 29 file / 223 tes                                                  |
| Coverage                | `npm run test:coverage`                                  | **Lulus**     | statements 84,85%; branches 79,19%; functions 90,25%; lines 84,84% |
| Build produksi          | `npm run build`                                          | **Lulus**     | 169 modul; JS 788,74 kB; CSS 28,77 kB                              |
| Bundle budget           | `npm run check:bundle`                                   | **Lulus**     | JS di bawah 850 kB; CSS di bawah 60 kB                             |
| Secret scan             | `npm run security:secrets`                               | **Lulus**     | 201 file tracked + 36 file `dist/`; tidak ada temuan               |
| Audit high/critical     | `npm run security:audit`                                 | **Lulus**     | 0 high/critical; 10 moderate `minimatch` dev (pemilik DevOps)      |
| Smoke + a11y publik     | `npm run test:e2e -- e2e/smoke.spec.ts e2e/a11y.spec.ts` | **Lulus**     | 3 lulus (A11Y-01, A11Y-02, smoke login), 4 skip karena kredensial  |
| A11y terautentikasi     | `npm run test:e2e -- e2e/a11y.spec.ts` dengan `.env.e2e` | **Terblokir** | A11Y-03..06 butuh kredensial/data staging (OPS-04)                 |
| SYNC race + expiry      | `npm run test:e2e -- e2e/sync.spec.ts` dengan admin env  | **Terblokir** | 4 tes terdaftar; eksekusi butuh Supabase staging (OPS-04)          |
| RLS matrix              | `supabase/tests/rls_matrix.sql` di staging               | **Terblokir** | Tidak ada Postgres/Supabase lokal (OPS-04)                         |
| Query plan              | `supabase/tests/query_plans.sql` di staging              | **Terblokir** | Butuh database staging (OPS-04)                                    |

## 3. Gate database dan keamanan

- [x] BE-01 matriks RLS terdokumentasi.
- [x] BE-02 unique partial index anti double booking tersedia di migrasi.
- [x] BE-03 kontrak error dan idempotensi RPC terdokumentasi.
- [x] BE-04 audit privasi realtime selesai.
- [x] BE-05 validasi storage dan skrip file yatim tersedia.
- [x] BE-06 rollback migrasi, backup, dan review index terdokumentasi.
- [x] BE-07 role memakai `app_metadata.role` lewat `public.current_user_role()`.
- [x] BE-08 grant minimum dan pencabutan grant tulis berbahaya tersedia.
- [ ] Migrasi 8–11 dijalankan dan diverifikasi di staging.
- [ ] RLS-14/RLS-15/RLS-16 dan DB-02..06 lulus di staging.
- [ ] Tidak ada booking aktif ganda setelah uji race di staging.
- [ ] Payload realtime tenant tidak memuat booking tenant lain di staging.

## 4. Gate UI dan QA manual

- [x] FE-01 error boundary global dan pemulihan chunk.
- [x] FE-02 reconnect realtime dan rollback optimistic.
- [x] FE-03 panel detail + checkout mobile.
- [x] FE-04 regression keyboard dan fokus.
- [x] FE-05 budget bundle.
- [x] FE-06 unit test error/expiry.
- [x] UX-04 audit token, radius, tipografi, dan copy.
- [x] QA-05 kebijakan flaky test dan durasi pipeline.
- [x] QA-06 test plan dan template sign-off rilis.
- [ ] QA-02 audit a11y halaman terautentikasi (A11Y-03..06).
- [ ] QA-03 suite negatif otorisasi dan RLS.
- [ ] QA-04 regresi responsif peta, checkout, dan tabel admin.
- [ ] UAT PM-02 dijalankan dan hasilnya dilampirkan.

## 5. Gate operasi

- [x] OPS-02 secret scanning + audit dependensi terjadwal.
- [x] OPS-03 runbook rollback frontend/database + tabletop.
- [ ] OPS-01 branch protection dan required checks aktif di repository.
- [ ] OPS-04 preview environment dan data uji terisolasi tersedia.
- [ ] OPS-05 monitoring error dan notifikasi deploy.
- [ ] OPS-06 backup/restore nyata dan keselarasan versi runtime.
- [ ] Simulasi rollback Vercel/Supabase nyata dicatat.
- [ ] Backup/PITR terbaru dicek sebelum deploy.

## 6. Blocker saat ini

| #   | Blocker                                                   | Dampak                                                             | Pemilik      | Rencana penutupan                        |
| --- | --------------------------------------------------------- | ------------------------------------------------------------------ | ------------ | ---------------------------------------- |
| B1  | `.env.e2e`, akun uji, dan Supabase staging belum tersedia | SYNC-01..04, A11Y-03..06, dan RLS staging tidak dapat dijalankan   | DevOps + QA  | OPS-04                                   |
| B2  | Migrasi dan RLS belum dieksekusi di Postgres nyata        | Jaminan double booking, grant, dan privasi realtime belum terbukti | Backend + QA | Jalankan migrasi 8–11 + `rls_matrix.sql` |
| B3  | Branch protection belum aktif                             | PR dengan gate gagal masih dapat di-merge                          | DevOps + PM  | OPS-01                                   |
| B4  | Rollback baru diuji lewat tabletop, belum simulasi nyata  | Target RTO/RPO belum terbukti                                      | DevOps + BE  | Simulasi staging setelah OPS-04          |
| B5  | Release note belum ada                                    | Pengguna/organizer belum tahu perubahan dan tindakan yang perlu    | PM           | PM-05 setelah REL-01 dan UAT             |

Aturan: blocker keamanan/data (B1, B2) **tidak boleh** di-waiver untuk produksi.
Blocker operasi hanya boleh di-waiver bila ada mitigasi tertulis dan pemilik.

## 7. Release note dan rollback

- [x] Rollback plan tersedia di `docs/ops/ROLLBACK.md`.
- [x] Risiko rollback per migrasi tercatat di `supabase/MIGRATIONS.md`.
- [x] Prosedur rotasi kunci tersedia di `docs/ops/SECRETS.md`.
- [ ] Release note pengguna tersedia (PM-05).
- [ ] Tindakan yang perlu dilakukan organizer dicantumkan (bila ada migrasi).
- [ ] Tautan PR/commit dan hasil verifikasi dicantumkan di release note.

## 8. Keputusan

Pilih satu:

- [ ] **GO** — semua gate wajib lulus; tidak ada blocker terbuka.
- [ ] **CONDITIONAL** — rilis dengan waiver tertulis, pemilik, dan tenggat.
- [x] **NO-GO** — masih ada blocker keamanan/data atau gate wajib terblokir.

Alasan:

```text
Gate otomatis lokal lulus, tetapi SYNC E2E, a11y terautentikasi, RLS matrix,
migrasi staging, simulasi rollback, branch protection, dan release note belum
tersedia. Rilis belum dapat dinyatakan siap.
```

## 9. Tanda tangan

| Peran           | Nama | Tanggal | Keputusan |
| --------------- | ---- | ------- | --------- |
| Product Manager |      |         |           |
| QA Engineer     |      |         |           |
| DevOps Engineer |      |         |           |
| Frontend lead   |      |         |           |
| Backend lead    |      |         |           |

## 10. Setelah blocker ditutup

1. Ulangi bagian 2 dan 3 dengan environment staging; lampirkan log.
2. Jalankan UAT PM-02 dan QA-02/03/04; catat hasil per skenario.
3. Selesaikan PM-05 (release note + komunikasi stakeholder).
4. Review dokumen ini di PR/issue rilis dan ubah status menjadi GO/CONDITIONAL.
5. Setelah deploy, pantau error rate/log minimal 30 menit dan isi catatan
   pasca-rilis di `docs/ops/ROLLBACK.md` bila ada rollback.

## 11. Referensi

- `NEXT_TASKS.txt`
- `docs/product/PM-01-release-scope.md`
- `docs/product/PM-02-uat-critical-flows.md`
- `docs/qa/RELEASE_SIGN_OFF.md`
- `docs/qa/FLAKY_TESTS.md`
- `docs/ops/ROLLBACK.md`
- `docs/ops/SECRETS.md`
- `qa_checklist_test_plan.md`
- `supabase/MIGRATIONS.md`
- `supabase/GRANTS.md`
- `supabase/AUTH_ROLES.md`
