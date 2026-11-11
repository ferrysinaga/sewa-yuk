-- BE-02: jaminan database terhadap double booking.
--
-- Sebelum migrasi ini, create_booking sudah mengunci baris booth dengan
-- FOR UPDATE sehingga dua permintaan pada booth yang sama diproses serial.
-- Namun invariant "satu booth = satu booking aktif" belum dijamin oleh
-- constraint, sehingga perubahan manual atau bug di masa depan bisa
-- meninggalkan dua booking aktif pada booth yang sama.
--
-- Migrasi ini:
--   1. membersihkan booking pending yang sudah kedaluwarsa;
--   2. memeriksa duplikat booking aktif dan berhenti dengan pesan jelas bila
--      ada (agar data tidak dihapus diam-diam);
--   3. menambahkan unique partial index bookings_one_active_per_booth_idx;
--   4. merekonsiliasi status booth dengan booking aktifnya;
--   5. memperluas release_expired_bookings agar melepas booth yatim.
--
-- Idempoten: aman dijalankan ulang.

do $$
begin
  if to_regclass('public.bookings') is null then
    raise exception 'Tabel public.bookings belum ada. Jalankan migrasi 20261103000500_bookings.sql terlebih dahulu.';
  end if;

  if to_regclass('public.booths') is null then
    raise exception 'Tabel public.booths belum ada. Jalankan migrasi 20261103000000_create_booths.sql terlebih dahulu.';
  end if;

  if to_regprocedure('public.release_expired_bookings()') is null then
    raise exception 'Fungsi public.release_expired_bookings() belum ada. Jalankan migrasi 20261111000000_rpc_idempotency_error_contract.sql terlebih dahulu.';
  end if;
end $$;

-- Bersihkan booking pending yang sudah lewat batas sebelum memeriksa
-- duplikat. Booking seperti ini masih berstatus pending di database sampai
-- sweep berjalan, padahal sudah tidak boleh menahan booth.
do $$
declare
  v_released integer;
begin
  v_released := public.release_expired_bookings();

  if v_released > 0 then
    raise notice 'BE-02: % booking pending kedaluwarsa dibatalkan sebelum membuat unique index.', v_released;
  end if;
end $$;

-- Deteksi duplikat booking aktif. Unique index tidak dapat dibuat bila masih
-- ada booth dengan lebih dari satu booking aktif. Sengaja berhenti dengan
-- pesan yang menyebut booth bermasalah agar operator dapat memutuskan booking
-- mana yang dipertahankan; migrasi tidak membatalkan booking secara diam-diam.
do $$
declare
  v_duplicates text;
begin
  select string_agg(
           format('%s (%s booking aktif)', booth_id, active_count),
           ', ' order by booth_id
         )
    into v_duplicates
    from (
      select booth_id, count(*) as active_count
        from public.bookings
       where booth_id is not null
         and status in ('pending', 'awaiting_confirmation', 'confirmed')
       group by booth_id
      having count(*) > 1
    ) duplicates;

  if v_duplicates is not null then
    raise exception
      'BE-02 gagal: booth berikut punya lebih dari satu booking aktif: %. Selesaikan duplikat (batalkan booking yang tidak dipakai) lalu jalankan ulang migrasi ini.',
      v_duplicates;
  end if;
end $$;

-- Satu booth hanya boleh memiliki satu booking aktif. Booking cancelled dan
-- riwayat lama tetap boleh berjumlah banyak karena tidak masuk partial index.
create unique index if not exists bookings_one_active_per_booth_idx
  on public.bookings (booth_id)
  where booth_id is not null
    and status in ('pending', 'awaiting_confirmation', 'confirmed');

comment on index public.bookings_one_active_per_booth_idx is
  'BE-02: satu booth hanya boleh punya satu booking aktif (pending/awaiting_confirmation/confirmed).';

-- Rekonsiliasi satu kali agar status booth kembali konsisten dengan booking.
-- Setelah unique index terpasang, kondisi ini tidak dapat muncul lagi lewat
-- jalur normal.
do $$
declare
  v_released integer := 0;
  v_booked integer := 0;
  v_reserved integer := 0;
begin
  update public.booths b
     set status = 'Available',
         updated_at = now()
   where b.status in ('Reserved', 'Booked')
     and not exists (
       select 1
         from public.bookings bk
        where bk.booth_id = b.id
          and bk.status in ('pending', 'awaiting_confirmation', 'confirmed')
     );

  get diagnostics v_released = row_count;

  update public.booths b
     set status = 'Booked',
         updated_at = now()
   where b.status <> 'Booked'
     and exists (
       select 1
         from public.bookings bk
        where bk.booth_id = b.id
          and bk.status = 'confirmed'
     );

  get diagnostics v_booked = row_count;

  update public.booths b
     set status = 'Reserved',
         updated_at = now()
   where b.status <> 'Reserved'
     and not exists (
       select 1
         from public.bookings bk
        where bk.booth_id = b.id
          and bk.status = 'confirmed'
     )
     and exists (
       select 1
         from public.bookings bk
        where bk.booth_id = b.id
          and bk.status in ('pending', 'awaiting_confirmation')
     );

  get diagnostics v_reserved = row_count;

  raise notice
    'BE-02 rekonsiliasi booth: % dilepas, % menjadi Booked, % menjadi Reserved.',
    v_released,
    v_booked,
    v_reserved;
end $$;

-- Perluas sweep: selain membatalkan booking kedaluwarsa, lepas juga booth
-- yang tidak punya booking aktif dan selaraskan booth dengan booking aktif.
-- Ini memastikan tidak ada booth tertahan tanpa booking aktif meskipun status
-- booth sempat diubah manual.
create or replace function public.release_expired_bookings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_released integer := 0;
begin
  for v_booking in
    select *
      from public.bookings
     where status = 'pending'
       and expires_at is not null
       and expires_at <= now()
     order by expires_at
       for update skip locked
  loop
    update public.bookings
       set status = 'cancelled',
           cancelled_at = now(),
           cancelled_reason = 'expired',
           updated_at = now()
     where id = v_booking.id;

    if v_booking.booth_id is not null then
      update public.booths
         set status = 'Available',
             updated_at = now()
       where id = v_booking.booth_id
         and status = 'Reserved';
    end if;

    v_released := v_released + 1;
  end loop;

  -- Booth tanpa booking aktif tidak boleh tetap Reserved/Booked.
  update public.booths b
     set status = 'Available',
         updated_at = now()
   where b.status in ('Reserved', 'Booked')
     and not exists (
       select 1
         from public.bookings bk
        where bk.booth_id = b.id
          and bk.status in ('pending', 'awaiting_confirmation', 'confirmed')
     );

  -- Booth dengan booking confirmed harus Booked.
  update public.booths b
     set status = 'Booked',
         updated_at = now()
   where b.status <> 'Booked'
     and exists (
       select 1
         from public.bookings bk
        where bk.booth_id = b.id
          and bk.status = 'confirmed'
     );

  -- Booth dengan booking pending/awaiting harus Reserved, kecuali sudah ada
  -- booking confirmed pada booth yang sama.
  update public.booths b
     set status = 'Reserved',
         updated_at = now()
   where b.status <> 'Reserved'
     and not exists (
       select 1
         from public.bookings bk
        where bk.booth_id = b.id
          and bk.status = 'confirmed'
     )
     and exists (
       select 1
         from public.bookings bk
        where bk.booth_id = b.id
          and bk.status in ('pending', 'awaiting_confirmation')
     );

  return v_released;
end;
$$;

revoke all on function public.release_expired_bookings() from public;
grant execute on function public.release_expired_bookings() to anon, authenticated;
