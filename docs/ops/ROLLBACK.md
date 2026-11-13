# Runbook Rollback Frontend dan Database (OPS-03)

Dokumen ini adalah hasil **OPS-03**. Tujuannya memberi jalur pemulihan yang
jelas dan cepat sebelum rilis berisiko. Prinsip utamanya: **forward-first** untuk
bug kecil, rollback hanya bila dampak pengguna atau risiko data lebih besar
daripada risiko rollback itu sendiri.

## 1. Ruang lingkup dan target

| Komponen           | Mekanisme rollback                                         | Target waktu       |
| ------------------ | ---------------------------------------------------------- | ------------------ |
| Frontend Vercel    | Promote deployment sebelumnya / instant rollback           | ≤ 5 menit          |
| Migrasi ringan     | Jalankan blok rollback migrasi terakhir, reverse order     | ≤ 15 menit         |
| Migrasi destruktif | Restore backup/PITR ke project baru, arahkan traffic       | ≤ 60 menit         |
| Storage            | Storage API/Dashboard, bukan `delete from storage.objects` | sesuai jumlah file |

Target pemulihan yang disepakati:

- **RTO frontend:** 5 menit setelah keputusan rollback.
- **RTO database:** 15 menit untuk migrasi non-destruktif; 60 menit bila perlu
  restore penuh.
- **RPO:** mengikuti backup/PITR Supabase yang aktif. Catat status backup
  sebelum migrasi besar; jangan mengasumsikan backup tersedia tanpa dicek.

## 2. Siapa yang boleh memutuskan

| Peran              | Tanggung jawab                                                          |
| ------------------ | ----------------------------------------------------------------------- |
| Incident Commander | PM atau delegate. Memutuskan rollback, prioritas, dan komunikasi.       |
| Backend owner      | BE. Menilai dampak migrasi, menyiapkan backup, menjalankan rollback DB. |
| Deploy owner       | DevOps. Menjalankan rollback Vercel dan memantau deployment.            |
| Verification owner | QA. Menjalankan smoke/regresi setelah rollback.                         |

Aturan:

- Siapa pun boleh **mengusulkan** rollback dengan menyebut gejala, dampak, dan
  waktu mulai.
- Incident Commander menyetujui rollback normal.
- **Emergency authority:** bila terjadi kebocoran data, kehilangan data, atau
  outage total, DevOps/BE on-call boleh menjalankan rollback frontend lebih dulu
  tanpa menunggu rapat, lalu melapor ke Incident Commander segera setelahnya.
- Satu orang menjadi komunikator tunggal agar instruksi tidak simpang siur.

## 3. Trigger rollback

Rollback dipertimbangkan bila salah satu terjadi:

- error rate/runtime error naik tajam setelah deploy;
- login, booking, atau halaman event tidak dapat dipakai;
- migrasi gagal di tengah dan meninggalkan skema tidak konsisten;
- RLS/grant baru memblokir alur utama (misalnya tenant tidak bisa memesan);
- data sensitif terlihat oleh role yang salah;
- bug kritis tanpa workaround cepat.

Jangan rollback hanya karena satu bug kosmetik; gunakan forward fix.

## 4. Rollback frontend (Vercel)

### 4.1 Dashboard

1. Buka **Vercel → Project → Deployments**.
2. Cari deployment terakhir yang diketahui stabil (cek commit hash dan waktu).
3. Buka menu **⋯ → Promote to Production** atau **Instant Rollback**.
4. Konfirmasi. Tunggu status deployment menjadi **Ready**.
5. Catat deployment URL/commit yang dipulihkan dan waktu mulai/selesai.

### 4.2 CLI (bila tersedia)

```bash
vercel ls
vercel promote <deployment-url>
# atau, tergantung versi CLI:
vercel rollback <deployment-url>
```

Verifikasi nama perintah pada versi CLI yang dipakai; jangan menebak di
produksi.

### 4.3 Verifikasi frontend

```bash
npx playwright test e2e/smoke.spec.ts
```

Manual:

- `/` dan `/event` termuat;
- `/login` berhasil untuk organizer dan tenant;
- `/event/:id` menampilkan booth;
- `/admin` dapat dibuka organizer dan ditolak tenant;
- bundle yang aktif sesuai deployment yang dipromosikan (cek hash di Network).

## 5. Rollback database

### 5.1 Sebelum rollback

1. Pastikan **tidak ada migrasi lain yang sedang berjalan**.
2. Catat versi migrasi terakhir yang sukses dan objek yang akan dihapus.
3. Ambil backup/PITR snapshot. Untuk staging/scratch:

   ```bash
   pg_dump "$SUPABASE_DB_URL" --format=custom --file=backup-before-rollback.dump
   ```

4. Baca blok rollback spesifik di `supabase/MIGRATIONS.md` bagian 5.
5. Uji di database scratch dengan transaksi:

   ```sql
   begin;
   -- tempel blok rollback
   rollback; -- ganti menjadi commit hanya setelah yakin
   ```

### 5.2 Urutan

- **Reverse order:** rollback migrasi terbaru lebih dulu (misalnya 11 → 10 → 9),
  karena policy, fungsi, dan FK saling bergantung.
- **Frontend dulu, lalu database** bila frontend baru bergantung pada skema
  baru. Setelah frontend lama aktif, baru jalankan rollback DB.
- **Storage bukan SQL:** hapus objek lewat Storage API/Dashboard agar file fisik
  ikut terhapus. Jangan `delete from storage.objects`.
- Untuk migrasi destruktif (drop kolom/tabel), hentikan penulisan sementara bila
  memungkinkan, backup, lalu restore. Ini membutuhkan persetujuan Incident
  Commander.

### 5.3 Batasan penting

- Rollback migrasi 10 (BE-07) membuka kembali **F1** (eskalasi role lewat
  `user_metadata`).
- Rollback migrasi 11 (BE-08) membuka kembali **F5** (grant tulis default).
- Rollback migrasi 9 (BE-02) menghapus unique index anti double booking.
- Rollback migrasi 7 menghapus data `cancelled_reason` dan RPC sweep.
- Rollback bukan pengganti forward fix. Setelah rollback, segera buat rencana
  perbaikan dan pasang kembali migrasi keamanan.

Detail per migrasi ada di `supabase/MIGRATIONS.md` bagian 5.2 dan 5.3.

## 6. Komunikasi

Gunakan satu kanal tim (misalnya kanal insiden) dengan format:

```text
[ROLLBACK] <ringkasan gejala>
Dampak   : <siapa/apa yang terdampak>
Mulai    : <waktu>
Tindakan : <frontend/database/keduanya>
Owner    : <nama>
ETA      : <perkiraan>
Status   : <in progress / selesai / dipantau>
```

- Update setiap 15 menit sampai status stabil.
- Setelah selesai, kirim ringkasan: akar masalah, langkah rollback, waktu
  pemulihan, data yang terdampak, dan tindak lanjut.
- Jangan menempelkan secret, token, atau data pribadi di kanal.

## 7. Verifikasi setelah rollback

- [ ] Deployment frontend berstatus Ready dan halaman utama termuat.
- [ ] Smoke E2E lulus.
- [ ] Login organizer/tenant berhasil dan redirect sesuai role.
- [ ] Booking baru dapat dibuat dan booth berubah status.
- [ ] Booking lama masih terbaca oleh pemiliknya.
- [ ] Tenant tidak dapat membuka `/admin` dan tidak dapat menulis data terlarang.
- [ ] Error rate/log kembali normal (minimal 30 menit pemantauan).
- [ ] Tidak ada migrasi yang tertinggal setengah jalan.
- [ ] Catatan insiden dan tindak lanjut dibuat.

## 8. Simulasi dan latihan

### 8.1 Tabletop 13 November 2026

Skenario: deploy frontend baru berhasil, lalu ditemukan tenant dapat menulis
`bookings` langsung karena migrasi grant belum aktif. Keputusan: rollback
frontend lebih dulu, lalu jalankan migrasi grant yang benar.

| Langkah                       | Perkiraan | Catatan                             |
| ----------------------------- | --------- | ----------------------------------- |
| Deteksi + konfirmasi dampak   | 5 menit   | Dari laporan QA/log                 |
| Keputusan Incident Commander  | 2 menit   | Emergency authority bila data bocor |
| Promote deployment sebelumnya | 3 menit   | Vercel Dashboard                    |
| Verifikasi smoke + login      | 5 menit   | QA                                  |
| Cek status migrasi & backup   | 5 menit   | BE                                  |
| Forward fix migrasi grant     | 15 menit  | Lebih aman daripada rollback DB     |
| Verifikasi RLS-15 + booking   | 10 menit  | Staging                             |

Hasil tabletop: jalur frontend dapat diselesaikan di bawah 15 menit. Rollback
database **tidak** dipilih karena forward fix grant lebih aman dan tidak
menghapus data.

### 8.2 Simulasi nyata (tertunda)

Simulasi rollback di environment non-produksi belum dijalankan karena tidak ada
akses Vercel/Supabase staging dari mesin ini (OPS-04). Saat staging tersedia:

1. Deploy versi uji, lalu rollback ke deployment sebelumnya; catat waktu.
2. Buat database scratch, replay migrasi, jalankan rollback satu migrasi,
   lalu replay; catat error dan waktu.
3. Ulangi untuk satu skenario restore backup.
4. Lampirkan hasilnya ke dokumen ini dan perbarui target waktu bila perlu.

## 9. Template catatan rollback

```text
Tanggal/waktu :
Insiden       :
Dampak        :
Keputusan     :
Dimulai       :
Selesai       :
Durasi        :
Komponen      : frontend / database / storage
Deployment    : <sebelum> -> <sesudah>
Migrasi       : <sebelum> -> <sesudah>
Data hilang   : ya/tidak, jelaskan
Verifikasi    : smoke / login / booking / RLS
Tindak lanjut :
```

## 10. Referensi

- `supabase/MIGRATIONS.md` (inventaris, rollback per migrasi, backup)
- `supabase/AUTH_ROLES.md` (risiko rollback BE-07)
- `supabase/GRANTS.md` (risiko rollback BE-08)
- `docs/ops/SECRETS.md` (rotasi kunci saat insiden)
- `.github/workflows/ci.yml` (gate sebelum deploy)
- `qa_checklist_test_plan.md` (regresi setelah rollback)
