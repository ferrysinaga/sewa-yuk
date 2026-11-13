# Secret Scanning, Audit Dependensi, dan Rotasi Kunci (OPS-02)

Dokumen ini adalah hasil **OPS-02**. Tujuannya memastikan tidak ada secret
sensitif di repo, log, atau bundle frontend, serta memberi jalur yang jelas bila
kunci bocor.

## 1. Aturan secret

| Variabel / kunci              | Boleh di frontend? | Tempat penyimpanan                         |
| ----------------------------- | ------------------ | ------------------------------------------ |
| `VITE_SUPABASE_URL`           | Ya                 | `.env` lokal, environment Vercel           |
| `VITE_SUPABASE_ANON_KEY`      | Ya (memang publik) | `.env` lokal, environment Vercel           |
| `SUPABASE_SERVICE_ROLE_KEY`   | **Tidak**          | Shell/CI script saja, tidak pernah `VITE_` |
| `E2E_SERVICE_ROLE_KEY`        | **Tidak**          | `.env.e2e` lokal/CI staging saja           |
| `sb_secret_*` (Supabase baru) | **Tidak**          | Server/CI saja                             |

Aturan:

- Hanya variabel berprefix `VITE_` yang boleh masuk bundle. Jangan pernah
  memberi prefix `VITE_` pada service role/secret key.
- Service role melewati RLS. Kunci ini hanya untuk skrip admin, E2E
  setup/teardown, dan operasi CI di staging.
- Jangan menempelkan kunci di issue, PR, log CI, screenshot, atau pesan chat.
- `.env` dan `.env.e2e` di-ignore oleh `.gitignore`. File contoh
  (`.env.example`, `.env.e2e.example`) harus tetap kosong.

## 2. Pemindaian otomatis

### 2.1 Lokal dan gate verify

```bash
npm run security:secrets
```

`scripts/check-secrets.mjs` memeriksa:

1. file `.env`/`.env.e2e` yang tidak sengaja ter-track;
2. pola private key, AWS access key, GitHub token, Stripe live key, dan
   Supabase `sb_secret_*`;
3. JWT yang payload-nya berisi `role: service_role`, baik di file tracked
   maupun di `dist/`.

Anon key JWT **tidak** ditolak karena memang publik. `npm run verify` sekarang
menjalankan pemindaian ini setelah build, sehingga bundle produksi ikut
diperiksa.

### 2.2 CI

`.github/workflows/security.yml`:

- **Secret scan** berjalan pada setiap push dan pull request: `npm ci`,
  `npm run build`, lalu `npm run security:secrets`.
- **Dependency audit** berjalan terjadwal setiap Senin 03:00 UTC dan dapat
  dijalankan manual (`workflow_dispatch`): `npm run security:audit`
  (`npm audit --audit-level=high`).

Aktifkan juga **GitHub native secret scanning** dan **push protection** di
**Settings → Code security and analysis**. Langkah ini manual karena merupakan
pengaturan repository, bukan file kode. Bila tersedia, aktifkan notifikasi ke
kanal tim.

## 3. Audit dependensi

Per 13 November 2026:

```text
npm run security:audit  -> lulus (tidak ada high/critical)
npm audit               -> 10 moderate
```

Temuan moderate berasal dari `minimatch` (DoS via globparts amplification) yang
masuk lewat rantai `eslint`/`typescript-eslint` dan hanya berada di
`devDependencies`. Tidak ada dampak runtime produksi, tetapi tetap dicatat.

| Temuan                           | Tingkat  | Pemilik | Tenggat    | Tindakan                                                            |
| -------------------------------- | -------- | ------- | ---------- | ------------------------------------------------------------------- |
| `minimatch` via eslint toolchain | Moderate | DevOps  | 2026-12-31 | Upgrade `eslint`/`typescript-eslint` saat versi kompatibel tersedia |

Jangan menjalankan `npm audit fix --force` tanpa review: perintah tersebut
mengusulkan downgrade `eslint` ke 9.x dan dapat memutus konfigurasi saat ini.
Setiap temuan high/critical harus punya pemilik dan tenggat sebelum merge.

## 4. Prosedur rotasi kunci

Lakukan bila kunci bocor, dicurigai bocor, atau sesuai jadwal rotasi.

1. **Identifikasi kunci** yang terdampak: anon, service role, atau secret key
   Supabase baru. Catat waktu dan cakupan pemakaian.
2. **Buat kunci baru** di Supabase Dashboard → **Project Settings → API**.
   Untuk project yang sudah memakai API key baru, gunakan menu secret/publishable
   key yang sesuai.
3. **Perbarui penyimpanan**:
   - environment Vercel (Production/Preview/Development);
   - `.env` lokal setiap developer;
   - secret CI (`E2E_SERVICE_ROLE_KEY`, bila dipakai);
   - environment staging/preview.
4. **Deploy ulang** frontend dan jalankan ulang job yang memakai kunci tersebut.
5. **Cabut kunci lama** setelah kunci baru terverifikasi. Jangan mencabut lebih
   dulu agar tidak memutus deployment yang sedang berjalan.
6. **Pantau** log Auth, PostgREST, Storage, dan error tracking minimal 24 jam.
7. **Catat** tanggal rotasi, alasan, dan pemilik di changelog internal/issue.

Bila kunci service role bocor:

- anggap seluruh data dapat diakses penyerang;
- rotasi segera, cabut kunci lama, dan periksa log akses tidak wajar;
- beri tahu PM/BE/DevOps dan tentukan apakah perlu insiden keamanan;
- jangan menyalin kunci ke issue; gunakan kanal aman.

## 5. Verifikasi

```bash
# Tidak ada output berarti .env/.env.e2e tidak ter-track.
git ls-files | grep -E '(^|/)\.env(\.e2e)?$'

# Pastikan file rahasia memang di-ignore.
git check-ignore -v .env .env.e2e

# Scan repo + dist dan audit dependensi.
npm run security:secrets
npm run security:audit
```

Untuk menguji detektor, buat file sementara di `dist/` berisi JWT dengan payload
`{"role":"service_role"}`; `npm run security:secrets` harus gagal dan menyebut
file tersebut. Hapus file uji setelahnya.

## 6. Batasan

- Pemindai ini menangkap pola umum, bukan pengganti secret scanning GitHub
  native atau alat khusus seperti gitleaks/trufflehog.
- Pemindaian `dist/` hanya melihat hasil build lokal/CI. Environment Vercel dan
  Supabase tetap harus direview manual.
- Audit dependensi membutuhkan akses registry npm; job terjadwal dapat gagal
  karena gangguan jaringan, bukan karena temuan.
- Rotasi nyata belum diuji karena tidak ada akses ke dashboard Supabase/Vercel
  dari mesin ini. Prosedur ini harus disimulasikan di staging (OPS-04).

## 7. Referensi

- `scripts/check-secrets.mjs`
- `.github/workflows/security.yml`
- `.github/workflows/ci.yml`
- `.gitignore`
- `.env.e2e.example`
- `supabase/AUTH_ROLES.md` dan `supabase/GRANTS.md` (pemakaian service role)
