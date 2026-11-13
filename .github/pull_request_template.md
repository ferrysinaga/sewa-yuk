## Ringkasan

<!-- Apa yang berubah dan mengapa? -->

## Jenis perubahan

- [ ] Fitur
- [ ] Perbaikan bug
- [ ] Refactor / performa
- [ ] Test / QA
- [ ] Dokumentasi / operasional
- [ ] Perubahan database / migrasi

## Gate otomatis

- [ ] `npm run verify` lulus (lint, format, typecheck, unit, build, budget, secret scan)
- [ ] `npm run test:coverage` lulus di CI
- [ ] `npm run test:e2e -- e2e/smoke.spec.ts e2e/a11y.spec.ts` lulus
- [ ] `npm run security:audit` lulus (tanpa high/critical)
- [ ] E2E SYNC / a11y terautentikasi dijalankan bila perubahan menyentuh booking, realtime, auth, atau halaman terautentikasi
- [ ] `supabase/tests/rls_matrix.sql` dijalankan di staging bila policy/grant berubah

## Dampak dan risiko

- [ ] Tidak mengubah routing, skema, RPC, Zustand, atau DnD
- [ ] Perubahan database disertai migrasi + rollback di `supabase/MIGRATIONS.md`
- [ ] Tidak ada secret baru di repo/bundle (`VITE_*` hanya untuk nilai publik)
- [ ] Sudah dicek di viewport mobile 375px dan keyboard

## Sign-off rilis

Bila PR ini memicu rilis, lampirkan checklist dari
`docs/qa/RELEASE_SIGN_OFF.md` dan isi keputusan **GO / CONDITIONAL / NO-GO**.
Untuk perubahan biasa, cukup centang gate otomatis di atas.

## Bukti

<!-- Screenshot, trace, log, atau tautan hasil test. Jangan tempel secret. -->
