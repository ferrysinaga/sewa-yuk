# Jaminan Double Booking

Dokumen ini menjelaskan jaminan database yang ditambahkan migrasi
`supabase/migrations/20261111000100_double_booking_guarantee.sql` (BE-02).

## 1. Invariant

Satu booth hanya boleh memiliki **satu** booking aktif. Booking aktif adalah
baris dengan status:

- `pending`
- `awaiting_confirmation`
- `confirmed`

Booking `cancelled` tidak dihitung, sehingga booth boleh dipesan ulang dan
riwayat lama tetap tersimpan.

## 2. Lapisan pengamanan

| Lapisan              | Mekanisme                                                | Perilaku saat race                                                             |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------ |
| RPC `create_booking` | `select ... for update` pada baris booth                 | Permintaan pada booth yang sama diproses serial                                |
| RPC `create_booking` | Pemeriksaan booking aktif sebelum insert                 | Pemanggil kedua ditolak `SWY_BOOTH_UNAVAILABLE`                                |
| Database             | Unique partial index `bookings_one_active_per_booth_idx` | Insert kedua gagal `23505`, ditangkap dan dipetakan ke `SWY_BOOTH_UNAVAILABLE` |
| Sweep                | `release_expired_bookings()`                             | Melepas booth yang tidak punya booking aktif                                   |

Definisi index:

```sql
create unique index bookings_one_active_per_booth_idx
  on public.bookings (booth_id)
  where booth_id is not null
    and status in ('pending', 'awaiting_confirmation', 'confirmed');
```

Frontend tidak perlu mengetahui nama index. `create_booking` menangkap
`unique_violation` khusus untuk index ini dan mengembalikan hint
`SWY_BOOTH_UNAVAILABLE`; error lain tetap diteruskan.

## 3. Preflight duplikat

Sebelum index dibuat, migrasi menjalankan `release_expired_bookings()` untuk
membersihkan booking pending yang sudah lewat batas. Bila masih ada booth
dengan lebih dari satu booking aktif, migrasi **berhenti** dengan pesan yang
menyebut booth bermasalah. Data tidak dibatalkan otomatis.

Cari duplikat:

```sql
select booth_id, count(*) as active_count,
       array_agg(id order by created_at) as booking_ids
from public.bookings
where booth_id is not null
  and status in ('pending', 'awaiting_confirmation', 'confirmed')
group by booth_id
having count(*) > 1;
```

Putuskan booking mana yang dipertahankan, lalu batalkan sisanya lewat RPC
`cancel_booking` (atau `update` terkontrol di SQL Editor), kemudian jalankan
ulang migrasi.

## 4. Rekonsiliasi booth

Migrasi dan setiap pemanggilan `release_expired_bookings()` menyelaraskan
status booth:

| Kondisi                                                          | Status booth |
| ---------------------------------------------------------------- | ------------ |
| Ada booking `confirmed`                                          | `Booked`     |
| Ada booking `pending`/`awaiting_confirmation`, tanpa `confirmed` | `Reserved`   |
| Tidak ada booking aktif                                          | `Available`  |

Ini menutup kasus booth yang tertahan `Reserved`/`Booked` karena perubahan
status manual atau kegagalan sebelumnya.

## 5. Verifikasi

Jalankan di Supabase SQL Editor setelah migrasi.

```sql
-- 1. Index ada dan unik.
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and indexname = 'bookings_one_active_per_booth_idx';

-- 2. Tidak ada booking aktif ganda. Hasil harus kosong.
select booth_id, count(*) as active_count
from public.bookings
where booth_id is not null
  and status in ('pending', 'awaiting_confirmation', 'confirmed')
group by booth_id
having count(*) > 1;

-- 3. Tidak ada booth tertahan tanpa booking aktif. Hasil harus kosong.
select b.id, b.status
from public.booths b
where b.status in ('Reserved', 'Booked')
  and not exists (
    select 1
    from public.bookings bk
    where bk.booth_id = b.id
      and bk.status in ('pending', 'awaiting_confirmation', 'confirmed')
  );
```

Uji constraint secara transaksional (ganti `<booth-id>` dan `<user-id>` dengan
data uji; seluruh perubahan di-rollback):

```sql
begin;

insert into public.bookings (
  booth_id, blueprint_id, user_id, booth_category, price, status, payment_method
)
select '<booth-id>', b.blueprint_id, '<user-id>', b.category, b.price, 'pending', 'va'
from public.booths b
where b.id = '<booth-id>';

-- Insert kedua harus gagal dengan unique_violation pada
-- bookings_one_active_per_booth_idx.
insert into public.bookings (
  booth_id, blueprint_id, user_id, booth_category, price, status, payment_method
)
select '<booth-id>', b.blueprint_id, '<user-id>', b.category, b.price, 'pending', 'va'
from public.booths b
where b.id = '<booth-id>';

rollback;
```

Uji konkurensi lewat UI memakai `e2e/sync.spec.ts`:

- **SYNC-03** membuka dua browser context, menekan tombol pemesanan hampir
  bersamaan, lalu memastikan tepat satu context berhasil dan yang kalah
  menerima pesan `Booth sudah tidak tersedia`.
- Tes ini membutuhkan `.env.e2e` dan booth `Available` sesuai
  `E2E_BOOTH_ID`.
