# Privasi Realtime dan Publication

Dokumen ini adalah hasil audit **BE-04** terhadap Supabase Realtime di sewa-yuk.
Cakupannya adalah tabel yang disiarkan, channel dan filter di frontend, serta
jaminan bahwa payload booking tidak bocor ke tenant lain.

Dokumen ini **tidak** mengubah skema, publication, atau kode realtime. Semua
perilaku di bawah berasal dari migrasi di `supabase/migrations/` dan hook di
`src/`.

## 1. Ringkasan eksekutif

- Publication `supabase_realtime` hanya memuat `public.booths` dan
  `public.bookings`. Keduanya memakai `replica identity full` dan RLS aktif.
- Supabase Realtime mengevaluasi policy `SELECT` tabel untuk setiap subscriber
  pada event `INSERT`/`UPDATE`. Tenant hanya menerima booking miliknya dan
  booth pada blueprint `published`; organizer menerima semua.
- Filter `user_id=eq.<uuid>` di channel tenant adalah optimisasi dan lapisan
  pertahanan tambahan, **bukan** batas keamanan. Tenant yang menghapus filter
  tetap tidak menerima baris tenant lain karena RLS.
- Event `DELETE` **tidak** difilter RLS oleh Realtime. Dengan RLS aktif,
  payload `old` hanya berisi primary key. Aplikasi tidak memiliki alur hapus
  booking, sehingga risiko ini rendah (lihat R1).
- Anon tidak menerima event `bookings` karena tidak ada policy `SELECT` untuk
  anon. Anon hanya menerima event booth dari blueprint `published`.
- Temuan F1 (role di `user_metadata` dapat dinaikkan sendiri) juga berlaku di
  realtime: tenant yang berhasil menaikkan role akan menerima event organizer.
  Remediasi ada di BE-07.

## 2. Konfigurasi publication

| Tabel               | Publication         | Replica identity | RLS | Ditambahkan oleh                              |
| ------------------- | ------------------- | ---------------- | --- | --------------------------------------------- |
| `public.booths`     | `supabase_realtime` | `full`           | Ya  | `20261103000200_tenant_realtime_policies.sql` |
| `public.bookings`   | `supabase_realtime` | `full`           | Ya  | `20261103000500_bookings.sql`                 |
| `public.blueprints` | Tidak               | default          | Ya  | -                                             |
| `storage.objects`   | Tidak               | default          | Ya  | -                                             |

Migrasi menambahkan tabel ke publication hanya jika publication sudah ada dan
tabel belum terdaftar, sehingga aman dijalankan ulang. `replica identity full`
dipakai agar payload `UPDATE`/`DELETE` memuat kolom yang dibutuhkan reducer.

Catatan: pada tabel dengan RLS, `replica identity full` **tidak** membuat
`payload.old` berisi seluruh kolom. Supabase tetap hanya mengirim primary key
di `old` untuk tabel ber-RLS. Kode aplikasi hanya memakai `old.id` pada
`DELETE`, sehingga perilaku ini aman.

## 3. Channel dan filter frontend

Nama channel dibuat dengan `createChannelName()` (`src/lib/id.ts`) sehingga
selalu mendapat suffix UUID acak.

| Channel (prefix)           | Halaman           | Aktor     | Tabel      | Filter                      |
| -------------------------- | ----------------- | --------- | ---------- | --------------------------- |
| `tenant-booths-<eventId>`  | `/event/:eventId` | Tenant    | `booths`   | `blueprint_id=eq.<eventId>` |
| `tenant-bookings-<userId>` | `/bookings`       | Tenant    | `bookings` | `user_id=eq.<userId>`       |
| `admin-bookings`           | `/admin/bookings` | Organizer | `bookings` | Tanpa filter                |
| `admin-booths`             | `/admin`          | Organizer | `booths`   | Tanpa filter                |

Semua channel memakai `event: '*'`, `schema: 'public'`, dan nama tabel yang
persis. Channel bersifat publik; namanya tidak boleh dianggap rahasia.

## 4. Matriks aktor x event realtime

| Aktor       | `bookings` INSERT/UPDATE                    | `bookings` DELETE | `booths` INSERT/UPDATE/DELETE     |
| ----------- | ------------------------------------------- | ----------------- | --------------------------------- |
| `anon`      | Tidak diterima (tidak ada policy `SELECT`)  | Tidak diterima    | Hanya booth blueprint `published` |
| `tenant`    | Hanya booking dengan `user_id = auth.uid()` | Lihat R1          | Hanya booth blueprint `published` |
| `organizer` | Semua booking                               | Lihat R1          | Semua booth, termasuk draft       |

Policy yang dievaluasi adalah policy `SELECT`:

- `bookings`: `Tenants can view own bookings` (`user_id = auth.uid()`) atau
  `Organizers can manage bookings` (role organizer).
- `booths`: `Booths are readable for published blueprints` (blueprint induk
  `published` atau role organizer).

Realtime **tidak** memakai policy `INSERT`/`UPDATE`/`DELETE` untuk menyaring
siaran. Karena itu, perubahan status booking oleh RPC tetap terlihat oleh
tenant pemilik selama baris masih lolos policy `SELECT`.

## 5. Perilaku UPDATE dan DELETE

### 5.1 UPDATE

Realtime memerlukan baris lama dan baru sama-sama lolos policy `SELECT`.
`bookings.user_id` tidak pernah diubah oleh RPC, sehingga booking tenant tetap
terlihat sebelum dan sesudah perubahan status. Efeknya:

- Tenant menerima `UPDATE` status booking miliknya (`pending` ->
  `awaiting_confirmation` -> `confirmed`, atau `cancelled`).
- Organizer menerima semua `UPDATE`.
- Jika suatu saat `user_id` dipindahkan ke tenant lain, tenant lama tidak akan
  menerima event lanjutan karena baris baru tidak lagi lolos policy.

### 5.2 DELETE

Supabase mendokumentasikan bahwa policy RLS **tidak** diterapkan pada event
`DELETE`, dan event `DELETE` tidak dapat difilter. Dengan RLS aktif, `old`
hanya berisi primary key. Implikasinya:

- Setiap subscriber tabel `bookings` dapat menerima `DELETE` berisi `id`
  booking mana pun, termasuk milik tenant lain.
- Aplikasi tidak menyediakan hapus booking; pembatalan memakai status
  `cancelled`, sehingga tidak ada event `DELETE` pada alur normal.
- `bookings.user_id` memakai `on delete cascade`. Menghapus akun auth akan
  menghapus booking dan memicu `DELETE` (hanya `id` yang terkirim). Ini
  dicatat sebagai R1.

## 6. Temuan dan risiko residual

### R1 — Event DELETE booking tidak difilter RLS (rendah)

Tidak ada alur hapus booking di aplikasi dan pembatalan memakai status. Risiko
muncul hanya bila admin menghapus baris `bookings` langsung atau menghapus akun
auth yang memiliki booking. Dampaknya adalah kebocoran ID booking (UUID), bukan
nama/email/telepon.

**Rekomendasi:** jangan menambahkan hapus langsung untuk `bookings`; gunakan
`cancel_booking`. Bila penghapusan akun diperlukan, dokumentasikan bahwa event
`DELETE` akan tersiar ke subscriber dan pertimbangkan menghapus booking lewat
job server dengan `replica identity` yang dikendalikan.

### R2 — Eskalasi role F1 juga membuka realtime organizer (kritis, tertutup oleh BE-07)

Tenant yang menaikkan `user_metadata.role` menjadi `organizer` akan lolos policy
`SELECT` organizer dan menerima seluruh event booking/booth. Ini bukan bug
Realtime, melainkan konsekuensi F1. Remediasi F1 (BE-07) otomatis menutup R2.

### R3 — Filter channel dapat dihapus oleh klien (rendah)

Filter `user_id=eq.<uuid>` hanya dikirim klien. Klien jahat dapat berlangganan
tanpa filter atau memakai nama channel `admin-bookings`. RLS tetap menolak baris
tenant lain; tidak ada data yang terkirim. Jangan menambahkan logika otorisasi
yang hanya mengandalkan nama channel atau filter.

### R4 — Tabel baru di publication di luar repo (sedang)

Publication dapat diubah lewat Dashboard tanpa review repo. Setiap tabel yang
ditambahkan ke `supabase_realtime` akan disiarkan ke subscriber yang lolos RLS
tabel tersebut. Skrip staging `supabase/tests/rls_matrix.sql` bagian 10
memeriksa `booths`/`bookings`, `replica identity`, dan RLS, serta memberi
`WARNING` bila ada tabel `public` lain di publication.

**Rekomendasi:** tinjau publication setiap kali menambah tabel, dan pastikan
tabel baru memiliki RLS + policy `SELECT` sebelum disiarkan.

### R5 — Payload organizer memuat PII tenant (diterima)

Organizer menerima seluruh kolom booking, termasuk `tenant_name`,
`tenant_email`, dan `tenant_phone`. Ini sesuai kebutuhan verifikasi pembayaran.
Batasi akses organizer dan jangan pernah memakai `service_role` di browser.

## 7. Verifikasi

### 7.1 Unit test

`src/hooks/useBookingFeed.test.tsx` memverifikasi kontrak channel:

- Feed tenant memakai tabel `bookings` dengan filter `user_id=eq.<userId>`.
- Feed organizer memakai tabel `bookings` tanpa filter.
- Nama channel tenant dan organizer berbeda.

Jalankan:

```bash
npm test -- src/hooks/useBookingFeed.test.tsx
```

### 7.2 Katalog database (staging)

Bagian 10 `supabase/tests/rls_matrix.sql` memeriksa:

- `supabase_realtime` ada dan memuat `public.booths` + `public.bookings`.
- Kedua tabel memakai `replica identity full` dan RLS aktif.
- `WARNING` bila ada tabel `public` lain di publication.

Jalankan skrip sesuai instruksi di `supabase/RLS_MATRIX.md`.

### 7.3 Uji manual payload (staging)

Persiapan: akun organizer, tenant A, tenant B; satu event `published`; satu
booth `Available`; dua browser context terpisah.

1. Buka DevTools > Console di kedua context. Tambahkan sementara
   `console.log('realtime', payload)` pada callback `postgres_changes`, atau
   gunakan tab Network > WS untuk melihat frame.
2. Login tenant A dan tenant B, lalu buka `/bookings` masing-masing.
3. Buat booking untuk tenant A pada booth uji.
4. **Ekspektasi:** tenant A menerima `INSERT`/`UPDATE` booking miliknya; tenant
   B tidak menerima payload booking tenant A. Organizer di `/admin/bookings`
   menerima keduanya.
5. Batalkan booking tenant A. **Ekspektasi:** tenant A menerima `UPDATE`
   `cancelled`; tenant B tidak menerima payload tersebut.
6. Buka `/event/:eventId` sebagai anon dan sebagai tenant. Ubah booth pada
   blueprint draft lewat organizer. **Ekspektasi:** hanya organizer yang
   menerima event booth draft; anon/tenant tidak.
7. Sebagai tenant, hapus filter `user_id` pada channel (uji di console) lalu
   buat booking tenant B. **Ekspektasi:** tenant A tetap tidak menerima baris
   tenant B (RLS), meskipun filter dihapus.

Catat hasil di `qa_checklist_test_plan.md` (RT-01..RT-04).

### 7.4 Batasan lokal

`.env.e2e` belum tersedia, sehingga `e2e/sync.spec.ts` dilewati di mesin lokal.
Uji payload nyata memerlukan staging (OPS-04). Unit test dan pemeriksaan katalog
SQL dapat dijalankan tanpa kredensial.

## 8. Referensi

- `supabase/migrations/20261103000200_tenant_realtime_policies.sql`
- `supabase/migrations/20261103000500_bookings.sql`
- `supabase/migrations/20261105000000_booking_expiry.sql`
- `src/hooks/useBookingFeed.ts`
- `src/pages/tenant/tenant-event-view/useTenantEventView.ts`
- `src/pages/admin/admin-dashboard/useAdminDashboard.ts`
- `src/lib/bookingRealtime.ts`
- `supabase/RLS_MATRIX.md`
- `supabase/tests/rls_matrix.sql`
