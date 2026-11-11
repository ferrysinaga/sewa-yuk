# Kontrak Error RPC Pemesanan

Dokumen ini adalah kontrak antara migrasi Supabase dan frontend untuk RPC
pemesanan. Frontend tidak boleh menampilkan pesan mentah PostgreSQL. Setiap
kegagalan membawa `hint` stabil yang dipetakan di
`src/lib/booking.ts` (`getBookingErrorMessage`).

## 1. Bentuk error Supabase

PostgREST mengembalikan objek error dengan field:

```json
{
  "code": "P0001",
  "message": "Booth sudah tidak tersedia. Silakan pilih booth lain.",
  "details": null,
  "hint": "SWY_BOOTH_UNAVAILABLE"
}
```

- `code` adalah SQLSTATE.
- `hint` adalah token stabil milik aplikasi. Gunakan `hint` sebagai sumber
  utama, lalu `code` sebagai fallback untuk server lama.
- `message` hanya untuk log dan fallback terakhir.

## 2. Daftar hint

| Hint                         | SQLSTATE | Pesan pengguna                                                        | Kapan muncul                                                                        |
| ---------------------------- | -------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `SWY_AUTH_REQUIRED`          | `42501`  | Silakan masuk terlebih dahulu untuk memesan booth.                    | `auth.uid()` null                                                                   |
| `SWY_INVALID_PAYMENT_METHOD` | `22023`  | Metode pembayaran tidak valid.                                        | Metode bukan `va`, `transfer`, atau `qris`                                          |
| `SWY_BOOTH_NOT_FOUND`        | `P0002`  | Booth tidak ditemukan. Muat ulang denah event.                        | `p_booth_id` tidak ada                                                              |
| `SWY_BOOTH_UNAVAILABLE`      | `P0001`  | Booth sudah tidak tersedia. Silakan pilih booth lain.                 | Booth bukan `Available`, atau sudah punya booking aktif                             |
| `SWY_EVENT_NOT_PUBLISHED`    | `P0001`  | Event ini belum dipublikasikan.                                       | Blueprint masih `draft` dan pemanggil bukan organizer                               |
| `SWY_BOOKING_NOT_FOUND`      | `P0002`  | Pemesanan tidak ditemukan. Muat ulang halaman Pesanan Saya.           | `p_booking_id` tidak ada                                                            |
| `SWY_NOT_OWNER`              | `42501`  | Anda tidak berhak mengubah pemesanan ini.                             | Booking milik tenant lain                                                           |
| `SWY_FORBIDDEN`              | `42501`  | Anda tidak memiliki akses untuk tindakan ini.                         | Bukan organizer saat memanggil `confirm_booking`                                    |
| `SWY_ALREADY_PAID`           | `P0001`  | Pemesanan ini sudah dibayar dan dikonfirmasi.                         | Booking sudah `confirmed`                                                           |
| `SWY_BOOKING_EXPIRED`        | `P0001`  | Pemesanan sudah kedaluwarsa. Booth telah dilepas untuk penyewa lain.  | Booking `cancelled` dengan alasan `expired`, atau `pending` yang lewat `expires_at` |
| `SWY_BOOKING_CANCELLED`      | `P0001`  | Pemesanan ini sudah dibatalkan.                                       | Booking `cancelled` dengan alasan `manual`                                          |
| `SWY_INVALID_STATE`          | `P0001`  | Status pemesanan tidak memungkinkan tindakan ini. Muat ulang halaman. | Transisi status tidak didukung                                                      |

Fallback SQLSTATE tanpa hint:

| SQLSTATE | Pesan pengguna                                              |
| -------- | ----------------------------------------------------------- |
| `23505`  | Booth sudah tidak tersedia. Silakan pilih booth lain.       |
| `42501`  | Anda tidak memiliki akses untuk tindakan ini.               |
| `P0002`  | Pemesanan tidak ditemukan. Muat ulang halaman Pesanan Saya. |
| `22023`  | Metode pembayaran tidak valid.                              |

## 3. Matriks idempotensi

| RPC                        | Pemanggilan ulang saat status sudah target                                         | Perilaku                                                                                              |
| -------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `create_booking`           | Pengguna sama punya booking `pending`/`awaiting_confirmation` pada booth yang sama | Mengembalikan booking yang ada; tidak membuat baris baru; status booth diselaraskan ke `Reserved`     |
| `create_booking`           | Booking `pending` milik pengguna sama sudah lewat `expires_at`                     | Ditolak `SWY_BOOKING_EXPIRED`; sweep `release_expired_bookings` membatalkan booking dan melepas booth |
| `create_booking`           | Pengguna sama punya booking `confirmed` pada booth yang sama                       | Ditolak `SWY_ALREADY_PAID`                                                                            |
| `create_booking`           | Pengguna lain punya booking aktif pada booth yang sama                             | Ditolak `SWY_BOOTH_UNAVAILABLE`                                                                       |
| `mark_booking_paid`        | Booking sudah `awaiting_confirmation`                                              | Mengembalikan booking yang ada                                                                        |
| `mark_booking_paid`        | Booking sudah `confirmed`                                                          | Ditolak `SWY_ALREADY_PAID`                                                                            |
| `cancel_booking`           | Booking sudah `cancelled`                                                          | Mengembalikan booking yang ada                                                                        |
| `cancel_booking`           | Booking sudah `confirmed`                                                          | Ditolak `SWY_INVALID_STATE`                                                                           |
| `confirm_booking`          | Booking sudah `confirmed`                                                          | Mengembalikan booking yang ada                                                                        |
| `release_expired_bookings` | Tidak ada booking kedaluwarsa                                                      | Mengembalikan `0`                                                                                     |

Catatan: `cancel_booking` pada booking `pending` yang sudah lewat
`expires_at` menulis `cancelled_reason = 'expired'`, bukan `manual`.

## 4. Keamanan fungsi

- Semua fungsi memakai `security definer` dan `set search_path = ''`.
- Semua referensi tabel ditulis dengan skema eksplisit (`public.*`,
  `auth.*`).
- Fungsi `create_booking`, `mark_booking_paid`, `cancel_booking`, dan
  `confirm_booking` hanya dapat dieksekusi oleh role `authenticated`.
- `release_expired_bookings` sengaja dapat dieksekusi oleh `anon` dan
  `authenticated` karena dipanggil saat halaman publik dibuka dan oleh sweep
  periodik.
- `create_booking` mengunci baris booth dengan `for update` sebelum memeriksa
  status, sehingga dua permintaan pada booth yang sama diproses serial.
- Migrasi BE-02 menambahkan unique partial index
  `bookings_one_active_per_booth_idx` sebagai jaring pengaman konkurensi.

## 5. Verifikasi manual

Jalankan di Supabase SQL Editor setelah migrasi:

```sql
-- 1. Pastikan fungsi memakai search_path aman.
select proname, proconfig
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in (
    'create_booking',
    'mark_booking_paid',
    'cancel_booking',
    'confirm_booking',
    'release_expired_bookings'
  );

-- 2. Pastikan anon tidak dapat mengeksekusi RPC tulis.
select has_function_privilege(
  'anon',
  'public.create_booking(uuid, text)',
  'execute'
) as anon_can_create_booking;

-- 3. Pastikan release_expired_bookings tetap dapat dipanggil anon.
select has_function_privilege(
  'anon',
  'public.release_expired_bookings()',
  'execute'
) as anon_can_release_expired;
```

Hasil yang diharapkan:

- `proconfig` berisi `search_path=` (kosong).
- `anon_can_create_booking` = `false`.
- `anon_can_release_expired` = `true`.

Uji idempotensi lewat aplikasi:

1. Buat booking, lalu klik **Buat Pesanan** dua kali cepat. Hanya satu baris
   booking yang muncul dan kode pesanan sama.
2. Klik **Sudah Bayar** dua kali. Status tetap `awaiting_confirmation` dan
   tidak ada error baru.
3. Batalkan booking yang sudah `cancelled` lewat pemanggilan ulang RPC.
   RPC mengembalikan booking yang sama, bukan error.
4. Verifikasi booking yang sudah `confirmed` dua kali. RPC mengembalikan
   booking yang sama.
