# PM-03 — Metrik Funnel dan Sumber Data

| Atribut     | Keterangan                                                               |
| ----------- | ------------------------------------------------------------------------ |
| Pemilik     | Product Manager                                                          |
| Kolaborator | FE, BE, DevOps                                                           |
| Status      | Definisi siap; baseline production menunggu data staging                 |
| Prinsip     | Mulai dari data yang sudah ada; analytics baru hanya bila terbukti perlu |
| Acuan       | `NEXT_TASKS.txt`, `supabase/migrations/*.sql`                            |

## 1. Prinsip pengukuran

1. **Actionable**: setiap metrik harus menghasilkan keputusan produk atau
   operasi. Metrik yang tidak dapat ditindaklanjuti tidak masuk katalog.
2. **Murah**: prioritas data dari tabel `bookings`, `booths`, dan `blueprints`.
   Event tracking baru hanya ditambahkan bila funnel tahap atas benar-benar
   dibutuhkan.
3. **Jujur**: metrik yang belum dapat dihitung ditandai **gap**, bukan diisi
   dengan angka perkiraan.
4. **Konsisten**: definisi status mengikuti `supabase/ERROR_CONTRACT.md` dan
   `PM-02-uat-critical-flows.md`.

## 2. Funnel yang ingin dipahami

```
Event dilihat  ->  Booth dipilih  ->  Checkout dimulai  ->  Booking dibuat
   (belum)          (belum)              (belum)             (tersedia)
        ->  Pembayaran dilaporkan  ->  Diverifikasi organizer
                 (sebagian)                  (tersedia)
```

| Tahap                  | Status instrumentasi | Sumber                                                                 |
| ---------------------- | -------------------- | ---------------------------------------------------------------------- |
| Event dilihat          | Belum                | Perlu event tracking ringan                                            |
| Booth dipilih          | Belum                | Perlu event tracking ringan                                            |
| Checkout dimulai       | Belum                | Perlu event tracking ringan                                            |
| Booking dibuat         | Tersedia             | `bookings.created_at`                                                  |
| Pembayaran dilaporkan  | Sebagian             | Status `awaiting_confirmation`/`confirmed`; timestamp khusus belum ada |
| Diverifikasi organizer | Tersedia             | `bookings.status='confirmed'`, `paid_at`                               |

Tahap atas funnel (event view, booth select, checkout start) sengaja belum
ditambahkan ke kode. Bila nanti dibutuhkan, gunakan skema minimal di bagian 6,
bukan analytics SDK berat.

## 3. Katalog metrik inti (7 metrik)

### M1 — Booking volume

| Atribut         | Isi                                                              |
| --------------- | ---------------------------------------------------------------- |
| Pertanyaan      | Berapa booking yang dibuat pada periode ini, per event?          |
| Definisi        | Jumlah baris `bookings` dengan `created_at` di dalam periode     |
| Rumus           | `count(*)`                                                       |
| Sumber          | `bookings.created_at`, `bookings.blueprint_id`                   |
| Pemilik         | PM (definisi), BE (query)                                        |
| Periode         | Mingguan, dipecah per blueprint                                  |
| Aksi bila turun | Periksa visibilitas event, kualitas denah, dan funnel tahap atas |

```sql
select
  date_trunc('week', created_at) as period,
  blueprint_id,
  count(*) as bookings
from public.bookings
where created_at >= now() - interval '12 weeks'
group by 1, 2
order by 1 desc, 2;
```

### M2 — Confirmation rate

| Atribut         | Isi                                                                 |
| --------------- | ------------------------------------------------------------------- |
| Pertanyaan      | Dari booking yang dibuat, berapa yang berakhir `confirmed`?         |
| Definisi        | Booking `confirmed` dibagi seluruh booking yang dibuat pada periode |
| Rumus           | `count(confirmed) / count(all bookings)`                            |
| Sumber          | `bookings.status`, `bookings.created_at`                            |
| Pemilik         | PM, BE                                                              |
| Periode         | Mingguan/bulanan                                                    |
| Aksi bila turun | Periksa pembayaran, latency verifikasi, dan copy instruksi bayar    |

```sql
select
  count(*) filter (where status = 'confirmed')::numeric
    / nullif(count(*), 0) as confirmation_rate
from public.bookings
where created_at >= now() - interval '30 days';
```

### M3 — Loss rate (cancelled manual)

| Atribut        | Isi                                                                                   |
| -------------- | ------------------------------------------------------------------------------------- |
| Pertanyaan     | Berapa booking yang dibatalkan pengguna/organizer?                                    |
| Definisi       | Booking `cancelled` dengan `cancelled_reason='manual'` dibagi seluruh booking periode |
| Rumus          | `count(cancelled manual) / count(all bookings)`                                       |
| Sumber         | `bookings.status`, `bookings.cancelled_reason`, `bookings.cancelled_at`               |
| Pemilik        | PM, BE                                                                                |
| Periode        | Mingguan                                                                              |
| Aksi bila naik | Wawancara tenant/organizer; periksa kejelasan checkout dan kebijakan batal            |

```sql
select
  count(*) filter (
    where status = 'cancelled' and cancelled_reason = 'manual'
  )::numeric / nullif(count(*), 0) as manual_loss_rate
from public.bookings
where created_at >= now() - interval '30 days';
```

### M4 — Expiry rate

| Atribut        | Isi                                                                                    |
| -------------- | -------------------------------------------------------------------------------------- |
| Pertanyaan     | Berapa booking yang hangus karena tidak dibayar dalam 24 jam?                          |
| Definisi       | Booking `cancelled` dengan `cancelled_reason='expired'` dibagi seluruh booking periode |
| Rumus          | `count(expired) / count(all bookings)`                                                 |
| Sumber         | `bookings.status`, `bookings.cancelled_reason`, `bookings.expires_at`                  |
| Pemilik        | PM, BE                                                                                 |
| Periode        | Mingguan                                                                               |
| Aksi bila naik | Periksa kejelasan batas waktu, pengingat, dan friction pembayaran                      |

```sql
select
  count(*) filter (
    where status = 'cancelled' and cancelled_reason = 'expired'
  )::numeric / nullif(count(*), 0) as expiry_rate
from public.bookings
where created_at >= now() - interval '30 days';
```

### M5 — Occupancy

| Atribut          | Isi                                                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pertanyaan       | Berapa persen booth pada event published yang sudah terisi?                                                                                        |
| Definisi         | **Sold occupancy**: booth `Booked` dibagi total booth pada blueprint `published`. **Held occupancy**: booth `Reserved`+`Booked` dibagi total booth |
| Rumus            | `count(Booked) / count(total booths)` dan `count(Reserved+Booked) / count(total booths)`                                                           |
| Sumber           | `booths.status`, `booths.blueprint_id`, `blueprints.status`                                                                                        |
| Pemilik          | PM, BE                                                                                                                                             |
| Periode          | Snapshot harian per blueprint                                                                                                                      |
| Aksi bila rendah | Tinjau harga, kategori, tata letak, dan kanal promosi organizer                                                                                    |

```sql
select
  b.blueprint_id,
  count(*) as total_booths,
  count(*) filter (where b.status = 'Booked') as booked_booths,
  count(*) filter (where b.status in ('Reserved', 'Booked')) as held_booths,
  count(*) filter (where b.status = 'Booked')::numeric
    / nullif(count(*), 0) as sold_occupancy,
  count(*) filter (where b.status in ('Reserved', 'Booked'))::numeric
    / nullif(count(*), 0) as held_occupancy
from public.booths b
join public.blueprints bp on bp.id = b.blueprint_id
where bp.status = 'published'
group by b.blueprint_id
order by b.blueprint_id;
```

Catatan: status booth harus konsisten dengan booking aktif. Rekonsiliasi BE-02
menjaga invariant ini; bila occupancy terlihat aneh, jalankan query booth yatim
di `supabase/DOUBLE_BOOKING.md`.

### M6 — Time to confirmation

| Atribut        | Isi                                                                          |
| -------------- | ---------------------------------------------------------------------------- |
| Pertanyaan     | Berapa lama dari booking dibuat sampai organizer mengonfirmasi?              |
| Definisi       | Median selisih `paid_at - created_at` untuk booking `confirmed` pada periode |
| Rumus          | `percentile_cont(0.5) within group (order by paid_at - created_at)`          |
| Sumber         | `bookings.paid_at`, `bookings.created_at`, `bookings.status`                 |
| Pemilik        | PM, BE                                                                       |
| Periode        | Mingguan/bulanan                                                             |
| Aksi bila lama | Pisahkan waktu bayar dan waktu verifikasi; ingatkan organizer                |

```sql
select
  percentile_cont(0.5) within group (
    order by extract(epoch from (paid_at - created_at)) / 3600
  ) as median_hours_to_confirm
from public.bookings
where status = 'confirmed'
  and paid_at is not null
  and created_at >= now() - interval '30 days';
```

**Gap**: skema saat ini tidak menyimpan timestamp saat tenant menandai sudah
bayar (`mark_booking_paid` hanya mengubah `status` dan `updated_at`). Karena
itu M6 menggabungkan waktu bayar + verifikasi. Bila perlu dipisah, tambahkan
kolom `payment_reported_at` lewat task backend terpisah, lalu definisikan:

- **Payment latency** = `payment_reported_at - created_at`
- **Verification latency** = `paid_at - payment_reported_at`

### M7 — Backlog dan aging

| Atribut        | Isi                                                                                                                     |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Pertanyaan     | Berapa booking yang tertahan di `pending`/`awaiting_confirmation`, dan sudah berapa lama?                               |
| Definisi       | Jumlah dan median umur booking aktif yang belum `confirmed`; untuk `pending`, hitung juga yang akan kedaluwarsa < 6 jam |
| Rumus          | `count(*)`, `percentile_cont(0.5) (now() - created_at)`                                                                 |
| Sumber         | `bookings.status`, `bookings.created_at`, `bookings.expires_at`                                                         |
| Pemilik        | PM, QA, BE                                                                                                              |
| Periode        | Harian                                                                                                                  |
| Aksi bila naik | Ingatkan tenant, percepat verifikasi organizer, periksa sweep expiry                                                    |

```sql
select
  status,
  count(*) as bookings,
  percentile_cont(0.5) within group (
    order by extract(epoch from (now() - created_at)) / 3600
  ) as median_age_hours
from public.bookings
where status in ('pending', 'awaiting_confirmation')
group by status;

select
  count(*) filter (where expires_at <= now() + interval '6 hours') as expiring_soon,
  count(*) as pending_total
from public.bookings
where status = 'pending';
```

## 4. Baseline

Baseline production belum tersedia. Baseline dari seed pengembangan:

| Metrik               | Baseline seed                    | Cara reproduksi                                                    |
| -------------------- | -------------------------------- | ------------------------------------------------------------------ |
| Blueprint published  | 3 (`hall-a`, `hall-b`, `hall-5`) | `select count(*) from public.blueprints where status='published';` |
| Total booth          | 6 (semua di `hall-a`)            | `select count(*) from public.booths;`                              |
| Booking volume       | 0                                | Query M1                                                           |
| Confirmation rate    | N/A (denominator 0)              | Query M2                                                           |
| Manual loss rate     | N/A (denominator 0)              | Query M3                                                           |
| Expiry rate          | N/A (denominator 0)              | Query M4                                                           |
| Occupancy            | 0% sold, 0% held                 | Query M5                                                           |
| Time to confirmation | N/A                              | Query M6                                                           |
| Backlog/aging        | 0                                | Query M7                                                           |

Setelah OPS-04 menyediakan staging dengan data uji, isi baseline sebenarnya:

| Metrik                  | Baseline staging | Tanggal | Eksekutor |
| ----------------------- | ---------------- | ------- | --------- |
| M1 Booking volume       |                  |         |           |
| M2 Confirmation rate    |                  |         |           |
| M3 Manual loss rate     |                  |         |           |
| M4 Expiry rate          |                  |         |           |
| M5 Occupancy            |                  |         |           |
| M6 Time to confirmation |                  |         |           |
| M7 Backlog/aging        |                  |         |           |

## 5. Cara pengambilan dan pemilik

| Aktivitas                 | Frekuensi                   | Pemilik   | Catatan                                    |
| ------------------------- | --------------------------- | --------- | ------------------------------------------ |
| Jalankan query M1–M4, M6  | Mingguan                    | BE/PM     | Simpan hasil di issue/PR metrik            |
| Snapshot M5               | Harian                      | BE/DevOps | Bisa dijadwalkan dengan pg_cron bila perlu |
| Cek M7                    | Harian                      | QA/PM     | Fokus pada booking yang mendekati expiry   |
| Review tren dan keputusan | Bulanan                     | PM        | Tulis hipotesis dan aksi berikutnya        |
| Validasi definisi         | Setiap perubahan status/RPC | BE + PM   | Perbarui dokumen bila definisi berubah     |

Tidak ada dashboard baru pada rilis ini. Query dijalankan manual di Supabase
SQL Editor atau lewat scheduled query ringan. Dashboard hanya dibuat bila
frekuensi dan jumlah pemangku kepentingan sudah membenarkan biaya operasional.

## 6. Instrumentasi funnel tahap atas (ditunda)

Bila event view, booth select, dan checkout start dibutuhkan, gunakan tabel
minimal berikut. Ini **bukan** bagian dari rilis keandalan dan belum dibuat.

```sql
create table public.analytics_events (
  id bigint generated always as identity primary key,
  event_name text not null check (
    event_name in ('event_view', 'booth_select', 'checkout_start')
  ),
  blueprint_id text,
  booth_id uuid,
  user_id uuid,
  session_id text,
  created_at timestamptz not null default now()
);
```

Aturan privasi:

- Jangan menyimpan email, nama, atau isi formulir.
- `user_id` hanya untuk pengguna terautentikasi; anon memakai `session_id`
  acak.
- Terapkan retensi (mis. 90 hari) dan akses baca hanya untuk organizer/PM
  melalui query agregat.
- Jangan mengirim event ke pihak ketiga tanpa persetujuan tertulis.

Metrik yang baru mungkin setelah instrumentasi:

| Metrik                   | Rumus                           | Keputusan                                   |
| ------------------------ | ------------------------------- | ------------------------------------------- |
| Event-to-booth rate      | `booth_select / event_view`     | Apakah denah dan filter membantu pemilihan? |
| Booth-to-checkout rate   | `checkout_start / booth_select` | Apakah panel detail meyakinkan?             |
| Checkout-to-booking rate | `bookings / checkout_start`     | Di mana friction checkout?                  |
| Event-to-confirmed rate  | `confirmed / event_view`        | Konversi ujung ke ujung                     |

## 7. Keputusan dan tindak lanjut

| #   | Keputusan                                                  | Alasan                                                  |
| --- | ---------------------------------------------------------- | ------------------------------------------------------- |
| D1  | Katalog inti memakai 7 metrik dari data yang ada           | Tidak perlu analytics baru untuk mulai mengukur         |
| D2  | Event view/booth select/checkout start ditunda             | Belum ada keputusan produk yang membutuhkannya sekarang |
| D3  | M6 memakai time to confirmation sebagai proxy              | Timestamp pembayaran terpisah belum ada                 |
| D4  | Tidak ada dashboard baru                                   | Query manual cukup untuk volume rilis saat ini          |
| D5  | Tambah `payment_reported_at` bila split latency dibutuhkan | Perubahan skema harus lewat task backend terpisah       |
