# Migrasi, Backup, Rollback, dan Review Index

Dokumen ini adalah hasil **BE-06**. Isinya adalah urutan dan dependensi migrasi,
prosedur replay dari database kosong, backup/restore, rollback per perubahan
berisiko, serta review index untuk query utama.

Dokumen ini **tidak** mengubah skema. Rekomendasi index baru sengaja belum
diterapkan karena keputusan akhir harus memakai `EXPLAIN (ANALYZE, BUFFERS)`
pada data staging yang representatif. Semua perintah di bawah hanya untuk
staging sampai ada persetujuan rilis.

## 1. Ringkasan eksekutif

- Ada 9 migrasi dengan urutan linear. Tiap file memeriksa dependensi dan
  ditulis idempoten, sehingga aman dijalankan ulang.
- Rollback dilakukan **berurutan terbalik**. Untuk tabel inti, rollback penuh
  bersifat destruktif; opsi yang dipilih secara default adalah rollback logis
  (hentikan pemakaian objek, pertahankan data) lalu perbaiki ke depan.
- Backup sebelum migrasi berisiko memakai `pg_dump` untuk schema/data dan
  backup terpisah untuk objek Storage. `pg_dump` tidak membackup file Storage.
- Index yang ada sudah menutup query utama: filter booth per blueprint, booking
  per tenant/booth/blueprint/status, sweep expiry, dan invariant satu booking
  aktif per booth.
- Tiga query sengaja melakukan scan/sort dan perlu tindak lanjut bila data
  tumbuh: pencarian admin dengan wildcard di depan, daftar booking admin
  berurutan `created_at`, dan agregasi metrik di klien. Detail ada di bagian 6.
- `supabase/tests/query_plans.sql` menyediakan pemeriksaan index dan
  `EXPLAIN (ANALYZE, BUFFERS)` untuk query utama. Skrip ini read-only dan hanya
  untuk staging.

## 2. Urutan migrasi dan dependensi

| Urutan | File                                                | Objek utama                                                            | Dependensi                             | Risiko rollback                          |
| ------ | --------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------- |
| 1      | `20261103000000_create_booths.sql`                  | Tabel `booths`, index `booths_blueprint_id_idx`, RLS + policy dasar    | Tidak ada                              | Tinggi (data denah hilang)               |
| 2      | `20261103000100_create_blueprints.sql`              | Tabel `blueprints`, policy baca/tulis, seed 3 event                    | Tidak ada (relasi ke booth hanya teks) | Tinggi (metadata event hilang)           |
| 3      | `20261103000200_tenant_realtime_policies.sql`       | Policy reservasi tenant, `replica identity full`, publication `booths` | 1                                      | Rendah                                   |
| 4      | `20261103000300_blueprint_publishing.sql`           | Kolom `status`, constraint, index, policy publish/draft                | 1, 2                                   | Sedang (status hilang)                   |
| 5      | `20261103000400_blueprint_images.sql`               | Kolom `image_url`/`image_path`, bucket + policy Storage                | 2                                      | Sedang (URL/path hilang; file tetap)     |
| 6      | `20261103000500_bookings.sql`                       | Tabel `bookings`, 5 index, RPC pemesanan, publication `bookings`       | 1, 2, 4                                | Kritis (riwayat booking hilang)          |
| 7      | `20261105000000_booking_expiry.sql`                 | `cancelled_reason`, index expiry, RPC sweep, jadwal `pg_cron`          | 6                                      | Sedang (alasan batal hilang; sweep mati) |
| 8      | `20261111000000_rpc_idempotency_error_contract.sql` | Body RPC idempoten + kontrak error + `revoke ... from public`          | 6, 7                                   | Rendah (fungsi saja)                     |
| 9      | `20261111000100_double_booking_guarantee.sql`       | Unique partial index + rekonsiliasi booth + sweep diperluas            | 6, 7, 8                                | Sedang (jaminan duplikat hilang)         |

### 2.1 Catatan dependensi

- Migrasi 4 membutuhkan `blueprints` dan `booths`; migrasi 6 juga membutuhkan
  kolom `blueprints.status`.
- Migrasi 7 membutuhkan `bookings`; migrasi 8 membutuhkan kolom
  `cancelled_reason`; migrasi 9 membutuhkan RPC `release_expired_bookings()`.
- Migrasi 9 memanggil `release_expired_bookings()` untuk membersihkan booking
  kedaluwarsa sebelum membuat unique index. Bila masih ada duplikat booking
  aktif, migrasi berhenti dengan pesan yang menyebut booth bermasalah; tidak
  ada booking yang dibatalkan diam-diam.
- Publication `supabase_realtime` hanya disentuh bila publication sudah ada.
  Di project tanpa Realtime, migrasi tetap berhasil dan hanya melewati
  penambahan tabel.

### 2.2 Idempotensi

Semua migrasi memakai `create table if not exists`, `add column if not exists`,
`create index if not exists`, `drop policy if exists` sebelum `create policy`,
`create or replace function`, dan `on conflict` untuk seed. Menjalankan ulang
file yang sama tidak menggandakan objek.

Yang **tidak** idempoten secara data:

- `20261103000300` menormalkan `blueprints.status` yang tidak valid menjadi
  `published` setiap kali dijalankan.
- `20261111000100` menjalankan rekonsiliasi booth setiap kali dijalankan.
- `20261111000000` hanya mengganti body fungsi; tidak mengubah data.
- Migrasi 7 menjadwalkan ulang job `pg_cron` dengan nama yang sama
  (`release-expired-bookings`), sehingga tidak membuat job ganda.

## 3. Replay dari database kosong (staging)

Tujuan: membuktikan migrasi dapat dijalankan dari nol dan diulang tanpa error.
Jangan memakai database produksi.

### 3.1 Prasyarat

- Project Supabase staging kosong atau database staging sekali pakai.
- `psql` yang bisa terhubung ke database staging (`SUPABASE_DB_URL`).
- Tiga akun uji untuk `rls_matrix.sql` (organizer, tenant A, tenant B).
- Variabel environment tidak boleh di-commit.

### 3.2 Jalankan berurutan

Bash/macOS/Linux:

```bash
for file in $(ls supabase/migrations/*.sql | sort); do
  echo "== $file"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$file" || break
done
```

PowerShell:

```powershell
Get-ChildItem supabase/migrations/*.sql | Sort-Object Name | ForEach-Object {
  Write-Host "== $($_.Name)"
  psql $env:SUPABASE_DB_URL -v ON_ERROR_STOP=1 -f $_.FullName
  if ($LASTEXITCODE -ne 0) { break }
}
```

### 3.3 Jalankan ulang untuk membuktikan idempotensi

Ulangi perintah yang sama. Ekspektasi:

- Tidak ada error `already exists`.
- Seed blueprint tidak bertambah (`on conflict (id) do nothing`).
- Migrasi 9 menampilkan notice rekonsiliasi; jumlah booth yang diubah boleh 0.
- Bila `pg_cron` tidak tersedia, muncul notice bahwa sweep dijalankan aplikasi.

### 3.4 Pemeriksaan setelah replay

```bash
psql "$SUPABASE_DB_URL" -v confirm_staging=yes \
  -v organizer_id='<uuid>' -v tenant_a_id='<uuid>' -v tenant_b_id='<uuid>' \
  -f supabase/tests/rls_matrix.sql

psql "$SUPABASE_DB_URL" -v confirm_staging=yes \
  -f supabase/tests/storage_audit.sql

psql "$SUPABASE_DB_URL" -v confirm_staging=yes \
  -v tenant_id='<uuid>' -v organizer_id='<uuid>' \
  -f supabase/tests/query_plans.sql
```

Lalu jalankan smoke test aplikasi terhadap staging: `/event`, `/event/:id`,
`/bookings`, dan `/admin/bookings`.

## 4. Backup dan restore

### 4.1 Sebelum migrasi berisiko

Checklist minimum:

1. Catat commit/versi aplikasi dan daftar migrasi yang akan dijalankan.
2. Pastikan backup harian Supabase (atau PITR) aktif. Untuk perubahan besar,
   buat backup manual di luar jadwal.
3. Backup schema + data `public`, ditambah metadata Storage.
4. Backup objek Storage secara terpisah (Dashboard atau Storage API).
5. Simpan backup terenkripsi di lokasi yang tidak dapat dihapus oleh operator
   yang sama.
6. Uji restore ke database scratch, bukan langsung ke produksi.

### 4.2 Perintah backup

```bash
# Schema + data public (custom format, bisa direstore selektif)
pg_dump "$SUPABASE_DB_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --schema=public \
  --file="backup-public-$(date +%Y%m%d-%H%M).dump"

# Schema saja, untuk review perubahan
pg_dump "$SUPABASE_DB_URL" \
  --schema-only \
  --schema=public \
  --file="schema-public-$(date +%Y%m%d-%H%M).sql"

# Metadata objek Storage (bukan file fisik)
pg_dump "$SUPABASE_DB_URL" \
  --data-only \
  --schema=storage \
  --file="storage-metadata-$(date +%Y%m%d-%H%M).sql"
```

Catatan:

- `pg_dump` **tidak** membackup file di bucket. File harus disalin lewat
  Dashboard/Storage API. Metadata saja tidak cukup untuk restore gambar.
- Schema `auth` dikelola Supabase. Untuk disaster recovery, gunakan backup
  platform Supabase; dump `auth` manual berisiko karena role/trigger internal.
- Jangan menjalankan `pg_restore --clean` ke database yang masih dipakai.

### 4.3 Restore ke database scratch

```bash
createdb sewa_yuk_restore   # atau project Supabase staging baru
pg_restore \
  --no-owner \
  --no-privileges \
  --dbname="postgresql://.../sewa_yuk_restore" \
  "backup-public-YYYYMMDD-HHMM.dump"
```

Setelah restore:

1. Jalankan ulang seluruh migrasi (bagian 3.2) untuk memastikan schema dump
   kompatibel dan idempoten.
2. Jalankan `rls_matrix.sql`, `storage_audit.sql`, dan `query_plans.sql`.
3. Bandingkan jumlah baris `blueprints`, `booths`, `bookings`, dan
   `storage.objects` dengan sumber.
4. Jalankan smoke test aplikasi terhadap database hasil restore.

### 4.4 Rollback drill

Latihan rollback dilakukan di database scratch:

1. Replay semua migrasi dari kosong.
2. Jalankan blok rollback yang relevan (bagian 5) secara terbalik.
3. Replay migrasi lagi dari awal.
4. Pastikan tidak ada error dan data uji dapat dibuat ulang.

## 5. Rollback

### 5.1 Prinsip

- **Forward-first:** untuk bug kecil, perbaiki dengan migrasi baru. Rollback
  skema berisiko kehilangan data.
- **Reverse order:** rollback migrasi 9 lebih dulu, lalu 8, 7, dan seterusnya.
  Melewati urutan dapat gagal karena FK, policy, atau fungsi yang saling
  bergantung.
- **Logical vs full:** rollback logis menghentikan pemakaian fitur tetapi
  mempertahankan tabel/kolom/data. Rollback penuh menghapus objek dan hanya
  dilakukan setelah backup serta persetujuan.
- **Transactional dry-run:** DDL PostgreSQL transaksional. Bungkus blok rollback
  dengan `begin; ... rollback;` di database scratch untuk melihat error tanpa
  perubahan permanen. `pg_cron` dan operasi eksternal tidak selalu transaksional.
- **Storage bukan SQL:** jangan menghapus baris `storage.objects` untuk
  "rollback" file. Gunakan Storage API/Dashboard agar file fisik ikut terhapus.

### 5.2 Ringkasan opsi per migrasi

| Migrasi      | Rollback logis                                      | Rollback penuh                                            | Catatan                                                                 |
| ------------ | --------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------- |
| 9 BE-02      | Drop unique index; pertahankan data                 | Sama, tidak ada data untuk dihapus                        | Rekonsiliasi booth adalah perbaikan, bukan perubahan yang perlu dibalik |
| 8 BE-03      | Jalankan ulang migrasi 7                            | Sama                                                      | Hanya body fungsi/ grant; jangan restore `EXECUTE` ke `PUBLIC`          |
| 7 Expiry     | Hentikan `pg_cron`, drop RPC sweep                  | Drop kolom `cancelled_reason` + index                     | Data alasan batal hilang pada rollback penuh                            |
| 6 Bookings   | Drop RPC + lepas publication, **pertahankan tabel** | Drop tabel `bookings`                                     | Riwayat booking hilang pada rollback penuh                              |
| 5 Images     | Hapus policy tulis; pertahankan bucket/kolom        | Drop kolom gambar; bucket hanya bila kosong               | File Storage tidak ikut terhapus oleh SQL                               |
| 4 Publishing | Kembalikan policy baca publik                       | Drop `status`, constraint, index                          | Status draft/published/archived hilang                                  |
| 3 Realtime   | Drop policy reservasi tenant                        | Lepas `booths` dari publication; replica identity default | Aplikasi versi lama memakai RPC, bukan update booth langsung            |
| 2 Blueprints | Pertahankan tabel                                   | Drop tabel `blueprints`                                   | Seed event hilang                                                       |
| 1 Booths     | Pertahankan tabel                                   | Drop tabel `booths`                                       | Harus setelah `bookings` dihapus/di-detach                              |

### 5.3 Blok rollback

Jalankan dari repo root. Blok di bawah adalah contoh untuk staging; sesuaikan
nama database dan path bila perlu.

#### 9 — BE-02 double booking guarantee

```sql
drop index if exists public.bookings_one_active_per_booth_idx;

-- Kembalikan body RPC ke versi BE-03 (tanpa rekonsiliasi booth).
\i supabase/migrations/20261111000000_rpc_idempotency_error_contract.sql
```

Efek: jaminan satu booking aktif per booth hilang. Data booking tidak berubah.
Bila rollback ini sementara, pertimbangkan mempertahankan index dan hanya
memperbaiki bug di aplikasi.

#### 8 — BE-03 RPC idempotency dan error contract

```sql
-- Jalankan setelah rollback BE-02.
\i supabase/migrations/20261105000000_booking_expiry.sql
```

Efek: body RPC kembali ke versi expiry. `revoke all ... from public` dari BE-03
sengaja dipertahankan karena pencabutan itu memperbaiki F5; jangan mengembalikan
`EXECUTE` ke `PUBLIC` kecuali ada alasan kompatibilitas yang kuat.

#### 7 — Booking expiry

```sql
do $$
begin
  if to_regnamespace('cron') is not null then
    begin
      perform cron.unschedule('release-expired-bookings');
    exception
      when others then null;
    end;
  end if;
end $$;

drop function if exists public.release_expired_bookings();
drop index if exists public.bookings_pending_expiry_idx;

alter table public.bookings
  drop constraint if exists bookings_cancelled_reason_check;

-- Rollback penuh: kolom ini menghapus alasan batal. Backup dulu.
alter table public.bookings
  drop column if exists cancelled_reason;

-- Kembalikan body mark/cancel/confirm ke versi sebelum expiry.
\i supabase/migrations/20261103000500_bookings.sql
```

Efek: sweep otomatis berhenti. Tanpa sweep, booking pending kedaluwarsa dapat
menahan booth. Pastikan aplikasi versi lama tetap memanggil sweep atau jalankan
sweep manual selama rollback.

#### 6 — Bookings

Rollback logis (disarankan, data dipertahankan):

```sql
drop function if exists public.create_booking(uuid, text);
drop function if exists public.mark_booking_paid(uuid);
drop function if exists public.cancel_booking(uuid);
drop function if exists public.confirm_booking(uuid);
drop function if exists public.release_expired_bookings();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and exists (
       select 1
         from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'bookings'
     )
  then
    alter publication supabase_realtime drop table public.bookings;
  end if;
end $$;
```

Tabel `bookings` dan datanya tetap ada; aplikasi versi lama mengabaikannya.
Rollback penuh (destruktif, setelah backup):

```sql
drop table if exists public.bookings;
```

Tabel tidak dapat dihapus bila masih ada FK dari objek lain. Saat ini tidak ada.

#### 5 — Blueprint images

```sql
drop policy if exists "Blueprint images are publicly readable" on storage.objects;
drop policy if exists "Organizers can upload blueprint images" on storage.objects;
drop policy if exists "Organizers can update blueprint images" on storage.objects;
drop policy if exists "Organizers can delete blueprint images" on storage.objects;

-- Rollback penuh: kolom gambar hilang. File di Storage tidak ikut terhapus.
alter table public.blueprints
  drop column if exists image_url,
  drop column if exists image_path;

-- Opsional: hapus bucket hanya bila benar-benar kosong.
delete from storage.buckets b
 where b.id = 'blueprint-assets'
   and not exists (
     select 1 from storage.objects o where o.bucket_id = b.id
   );
```

Peringatan: bucket publik tetap dapat diakses lewat public URL meskipun policy
`SELECT` dihapus. Untuk benar-benar menutup akses, ubah bucket menjadi privat
dan hapus/salin objeknya lewat Storage API. Jangan menghapus baris
`storage.objects` langsung.

#### 4 — Blueprint publishing

```sql
drop policy if exists "Published blueprints are publicly readable" on public.blueprints;
create policy "Blueprints are publicly readable"
  on public.blueprints
  for select
  using (true);

drop policy if exists "Booths are readable for published blueprints" on public.booths;
create policy "Booths are publicly readable"
  on public.booths
  for select
  using (true);

drop index if exists public.blueprints_status_idx;

alter table public.blueprints
  drop constraint if exists blueprints_status_check;

-- Rollback penuh: status draft/published/archived hilang.
alter table public.blueprints
  drop column if exists status;
```

Efek: semua blueprint dan booth dapat dibaca publik kembali. Pastikan itu
memang perilaku yang diinginkan sebelum rollback.

#### 3 — Tenant realtime policies

```sql
drop policy if exists "Tenants can reserve available booths" on public.booths;

alter table public.booths replica identity default;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and exists (
       select 1
         from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'booths'
     )
  then
    alter publication supabase_realtime drop table public.booths;
  end if;
end $$;
```

#### 2 — Blueprints

```sql
drop policy if exists "Blueprints are publicly readable" on public.blueprints;
drop policy if exists "Organizers can manage blueprints" on public.blueprints;
drop table if exists public.blueprints;
```

Tabel `booths.blueprint_id` hanya teks tanpa FK, jadi tidak menghalangi.

#### 1 — Booths

```sql
drop policy if exists "Booths are publicly readable" on public.booths;
drop policy if exists "Organizers can manage booths" on public.booths;
drop table if exists public.booths;
```

Tabel `bookings` harus sudah dihapus, atau FK `bookings_booth_id_fkey` dilepas
lebih dulu. Melepas FK tanpa menghapus booking akan meninggalkan referensi
booth yang tidak valid.

## 6. Review index dan query

### 6.1 Inventaris index

| Index                               | Definisi                                                   | Dipakai untuk                                     | Status |
| ----------------------------------- | ---------------------------------------------------------- | ------------------------------------------------- | ------ |
| `booths_pkey`                       | `booths (id)`                                              | Lock booth, lookup by id                          | Wajib  |
| `booths_blueprint_id_idx`           | `booths (blueprint_id)`                                    | Peta event, daftar booth per blueprint            | Wajib  |
| `blueprints_pkey`                   | `blueprints (id)`                                          | Lookup event                                      | Wajib  |
| `blueprints_status_idx`             | `blueprints (status)`                                      | Daftar event `published`                          | Wajib  |
| `bookings_pkey`                     | `bookings (id)`                                            | RPC by id, realtime payload                       | Wajib  |
| `bookings_booking_code_idx`         | unique `bookings (booking_code)`                           | Mencegah kode ganda; tampilan kode                | Wajib  |
| `bookings_user_id_idx`              | `bookings (user_id)`                                       | RLS tenant, daftar booking tenant                 | Wajib  |
| `bookings_booth_id_idx`             | `bookings (booth_id)`                                      | Riwayat per booth, join rekonsiliasi              | Wajib  |
| `bookings_blueprint_id_idx`         | `bookings (blueprint_id)`                                  | Filter event admin, metrik per event              | Wajib  |
| `bookings_status_idx`               | `bookings (status)`                                        | Filter status admin, metrik                       | Wajib  |
| `bookings_pending_expiry_idx`       | partial `bookings (expires_at) where status = 'pending'`   | Sweep expiry                                      | Wajib  |
| `bookings_one_active_per_booth_idx` | unique partial `bookings (booth_id) where status in (...)` | Invariant anti double booking, preflight duplikat | Wajib  |

Tidak ada index duplikat dengan definisi identik. `bookings_booth_id_idx` dan
`bookings_one_active_per_booth_idx` sama-sama memakai `booth_id`, tetapi yang
kedua hanya mencakup booking aktif dan unik; keduanya punya peran berbeda.
Jangan menghapus `bookings_booth_id_idx` karena masih dipakai untuk riwayat dan
pemeriksaan FK.

### 6.2 Matriks query utama

| Query                          | Sumber                                           | Predikat/urut                                                                 | Index yang dipakai                             | Ekspektasi                                     | Tindakan                                                    |
| ------------------------------ | ------------------------------------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------- |
| Daftar event published         | `EventExplorer.tsx`                              | `status = 'published'` + `order by created_at desc`                           | `blueprints_status_idx` + sort                 | Scan kecil lalu sort                           | Tambah index komposit bila event published > ribuan         |
| Peta booth satu event          | `useTenantEventView.ts`, `useBlueprintEditor.ts` | `blueprint_id = :id`                                                          | `booths_blueprint_id_idx`                      | Index scan                                     | Tidak ada                                                   |
| Booth untuk banyak event       | `EventExplorer.tsx`                              | `blueprint_id in (...)`                                                       | `booths_blueprint_id_idx`                      | Index scan                                     | Tidak ada                                                   |
| Semua booth di dashboard admin | `useAdminDashboard.ts`                           | `order by created_at desc` tanpa filter                                       | Seq scan + sort                                | Scan penuh disengaja; tabel denah kecil        | Pantau bila booth > puluhan ribu                            |
| Booking tenant                 | `useTenantBookings.ts` + RLS                     | `user_id = auth.uid()` + `order by created_at desc`                           | `bookings_user_id_idx` + sort                  | Index scan per tenant                          | Index komposit bila riwayat per tenant besar                |
| Halaman booking admin          | `useAdminBookings.ts`                            | `order by created_at desc` + `limit/offset`, filter status/blueprint opsional | Seq scan + top-N sort atau index filter + sort | Offset pagination makin lambat di halaman jauh | Tambah index `created_at`/komposit dan pertimbangkan keyset |
| Pencarian booking admin        | `useAdminBookings.ts`                            | `ilike '%term%'` pada kode/nama/email/kategori                                | Tidak ada (wildcard di depan)                  | Seq scan by design                             | `pg_trgm` + GIN bila tabel besar                            |
| Metrik booking admin           | `useAdminBookings.ts`                            | Ambil `id,status,price,expires_at,cancelled_reason` semua baris               | Seq scan                                       | Agregasi di klien; data kecil                  | Pindahkan ke agregasi SQL bila ribuan baris                 |
| Sweep expiry                   | `release_expired_bookings()`                     | `status = 'pending' and expires_at <= now()` + `order by expires_at`          | `bookings_pending_expiry_idx`                  | Index scan parsial                             | Tidak ada                                                   |
| Preflight duplikat             | `DOUBLE_BOOKING.md`                              | `group by booth_id` untuk status aktif                                        | `bookings_one_active_per_booth_idx`            | Index-only scan                                | Tidak ada                                                   |
| Lock booth saat checkout       | `create_booking()`                               | `where id = :booth_id for update`                                             | `booths_pkey`                                  | Index scan + row lock                          | Tidak ada                                                   |

### 6.3 Temuan dan rekomendasi

#### R1 — Pencarian admin memakai wildcard di depan (diterima)

`ilike '%term%'` tidak dapat memakai index B-tree. Saat ini jumlah booking
masih kecil, sehingga scan penuh lebih murah daripada index tambahan. Bila
tabel tumbuh, aktifkan `pg_trgm` dan buat GIN index untuk kolom yang dicari:

```sql
create extension if not exists pg_trgm;
create index concurrently if not exists bookings_booking_code_trgm_idx
  on public.bookings using gin (booking_code gin_trgm_ops);
-- Ulangi untuk tenant_name, tenant_email, booth_category bila perlu.
```

Index GIN menambah biaya tulis dan ukuran. Ukur dulu dengan `EXPLAIN`.

#### R2 — Daftar booking admin: sort `created_at` tanpa index (dipantau)

Query memakai `order by created_at desc` dengan `limit/offset`. Pada tabel
kecil, planner memilih seq scan + sort; itu wajar. Bila baseline menunjukkan
sort cost tinggi, kandidat pertama:

```sql
create index concurrently if not exists bookings_created_at_idx
  on public.bookings (created_at desc);
```

Untuk filter yang sering dipakai, pertimbangkan index komposit
`(status, created_at desc)` dan `(blueprint_id, created_at desc)`. Offset besar
tetap lambat; jangka panjang gunakan keyset pagination.

#### R3 — Riwayat booking tenant (dipantau)

RLS membatasi `user_id = auth.uid()`, lalu diurutkan `created_at desc`. Index
`user_id` sudah menyaring tenant. Bila satu tenant punya ribuan booking,
tambahkan:

```sql
create index concurrently if not exists bookings_user_created_at_idx
  on public.bookings (user_id, created_at desc);
```

#### R4 — Daftar event published (dipantau)

`blueprints_status_idx` menyaring status, lalu sort kecil. Bila event published
bertambah banyak:

```sql
create index concurrently if not exists blueprints_status_created_at_idx
  on public.blueprints (status, created_at desc);
```

#### R5 — Agregasi metrik di klien (diterima untuk sekarang)

`useAdminBookings` mengambil seluruh baris ringan untuk menghitung metrik.
Ini bukan masalah index, melainkan volume transfer. Bila booking tumbuh,
pindahkan agregasi ke RPC/view dengan `count`, `sum`, dan filter status.

#### R6 — `auth.jwt()` dievaluasi di policy (catatan keamanan/performa)

Policy memanggil `auth.jwt()` per baris. Supabase menyarankan membungkusnya
dengan subquery stabil (`(select auth.jwt())`) untuk membantu planner. Perubahan
ini menyentuh policy keamanan dan harus digabung dengan remediasi F1/BE-07,
bukan dilakukan terpisah di BE-06.

#### R7 — Statistik planner

Setelah import/replay data besar, jalankan `analyze public.booths` dan
`analyze public.bookings` agar planner memakai statistik terbaru. Autovacuum
biasanya menangani ini, tetapi database staging yang baru diisi massal perlu
`ANALYZE` manual.

### 6.4 Template baseline staging

Isi setelah menjalankan `query_plans.sql`. Jangan mengarang angka.

| Query              | Baris tabel | Rencana (index/seq scan) | Shared buffers | Execution time | Verdict |
| ------------------ | ----------- | ------------------------ | -------------- | -------------- | ------- |
| Event published    |             |                          |                |                |         |
| Booth per event    |             |                          |                |                |         |
| Booking tenant     |             |                          |                |                |         |
| Booking admin page |             |                          |                |                |         |
| Pencarian admin    |             |                          |                |                |         |
| Sweep expiry       |             |                          |                |                |         |
| Preflight duplikat |             |                          |                |                |         |

## 7. Verifikasi staging

`supabase/tests/query_plans.sql` adalah skrip read-only yang:

- memastikan index wajib ada dan unique/partial index yang penting tetap
  memiliki definisi yang benar;
- menampilkan ukuran tabel, jumlah baris perkiraan, dan pemakaian index;
- menjalankan `EXPLAIN (ANALYZE, BUFFERS)` untuk query utama;
- memeriksa index duplikat dan melaporkan index yang belum pernah dipakai.

Jalankan:

```bash
psql "$SUPABASE_DB_URL" -v confirm_staging=yes \
  -v tenant_id='<uuid-tenant>' \
  -v organizer_id='<uuid-organizer>' \
  -f supabase/tests/query_plans.sql
```

Cara membaca hasil:

- `Seq Scan` pada tabel kecil adalah normal. Yang perlu ditindak lanjuti adalah
  `Seq Scan` pada tabel besar dengan `Rows Removed by Filter` tinggi.
- `Sort Method: external merge Disk` menandakan `work_mem` kurang atau data
  yang diurutkan terlalu besar; pertimbangkan index komposit.
- `Buffers: shared read` yang tinggi pada query berulang menandakan cache miss;
  bandingkan setelah query kedua.
- `idx_scan = 0` pada staging yang baru dipakai belum tentu berarti index tidak
  berguna; statistik bisa belum terkumpul. Konfirmasi dengan `EXPLAIN`.

Skrip ini tidak mengubah data. `EXPLAIN ANALYZE` hanya menjalankan `SELECT`.

## 8. Batasan lokal

Mesin pengembangan ini tidak memiliki `psql`, Supabase CLI, Docker, atau
kredensial staging. Karena itu:

- replay dari database kosong belum dijalankan;
- rollback drill belum dijalankan;
- baseline `EXPLAIN` belum diisi;
- `rls_matrix.sql`, `storage_audit.sql`, dan `query_plans.sql` belum dieksekusi
  terhadap Postgres nyata.

Yang sudah diverifikasi lokal adalah `npm run verify` (lint, format, typecheck,
unit test, build, budget). Verifikasi database tetap memerlukan staging
(OPS-04).

## 9. Referensi

- `supabase/migrations/` (9 file migrasi)
- `supabase/RLS_MATRIX.md`
- `supabase/DOUBLE_BOOKING.md`
- `supabase/ERROR_CONTRACT.md`
- `supabase/STORAGE.md`
- `supabase/tests/query_plans.sql`
- `qa_checklist_test_plan.md` (DB-01..DB-05)
