# Grant Minimum dan Hardening F5 (BE-08)

Dokumen ini adalah hasil **BE-08**. Tujuannya menutup temuan **F5** dari
`supabase/RLS_MATRIX.md`: project Supabase standar memberi grant
`SELECT/INSERT/UPDATE/DELETE/TRUNCATE` dan `EXECUTE` kepada `anon` dan
`authenticated` untuk objek baru di schema `public`. RLS menolak tenant, tetapi
grant tulis membuat organizer dapat menulis `bookings` langsung tanpa RPC dan
anon dapat mencapai badan RPC tulis.

Perubahan diterapkan oleh
`supabase/migrations/20261112000100_grant_hardening.sql`. Migrasi ini **bukan**
pengganti RLS: RLS tetap kontrol utama. Grant adalah lapisan kedua agar operasi
yang tidak pernah dibutuhkan aplikasi tidak dapat dicoba sama sekali.

## 1. Ringkasan perubahan

| Objek                                             | anon sebelum | anon sesudah | authenticated sebelum | authenticated sesudah         |
| ------------------------------------------------- | ------------ | ------------ | --------------------- | ----------------------------- |
| `public.booths`                                   | ALL          | `SELECT`     | ALL                   | `SELECT/INSERT/UPDATE/DELETE` |
| `public.blueprints`                               | ALL          | `SELECT`     | ALL                   | `SELECT/INSERT/UPDATE/DELETE` |
| `public.bookings`                                 | ALL          | tidak ada    | ALL                   | `SELECT`                      |
| RPC tulis (`create`, `mark`, `cancel`, `confirm`) | `EXECUTE`    | tidak ada    | `EXECUTE`             | `EXECUTE`                     |
| `release_expired_bookings()`                      | `EXECUTE`    | `EXECUTE`    | `EXECUTE`             | `EXECUTE`                     |
| `current_user_role()`                             | `EXECUTE`    | `EXECUTE`    | `EXECUTE`             | `EXECUTE`                     |

`TRUNCATE`, `REFERENCES`, dan `TRIGGER` dicabut dari `authenticated` pada ketiga
tabel. `TRUNCATE` tidak pernah dipakai aplikasi; `REFERENCES`/`TRIGGER` hanya
dibutuhkan operasi DDL admin, bukan runtime.

## 2. Mengapa authenticated masih boleh menulis booths/blueprints

Editor denah organizer memakai Supabase client langsung untuk
`insert/update/delete` pada `booths` dan `blueprints` (lihat
`useBlueprintEditor.ts` dan `useAdminBlueprintList.ts`). Kedua tabel memakai
role database yang sama, `authenticated`, untuk organizer dan tenant. Grant
tabel tidak dapat dibedakan per role aplikasi.

Karena itu:

- grant tulis tetap ada untuk `authenticated`;
- policy `Organizers can manage booths/blueprints` membatasi ke
  `public.current_user_role() = 'organizer'`;
- tenant tetap ditolak RLS meskipun grant tabel ada;
- `anon` tidak memiliki grant tulis sama sekali.

Memindahkan seluruh tulis denah ke RPC akan menghilangkan grant tulis
`authenticated`, tetapi itu perubahan arsitektur besar dan tidak diperlukan
untuk menutup F5. Grant minimum di sini sudah menghilangkan jalur yang paling
berbahaya: tulis `bookings` dan RPC tulis oleh anon.

## 3. Bookings hanya lewat RPC

Sebelum BE-08, policy `Organizers can manage bookings` adalah `FOR ALL`.
Dikombinasikan dengan grant tulis default, organizer dapat `PATCH
/rest/v1/bookings` langsung. BE-08:

1. mencabut `INSERT/UPDATE/DELETE/TRUNCATE` pada `bookings` dari
   `authenticated`;
2. menyisakan `SELECT` untuk `authenticated`;
3. mengganti policy organizer menjadi `FOR SELECT`;
4. mencabut seluruh grant `bookings` dari `anon`.

Semua perubahan status tetap dilakukan RPC `SECURITY DEFINER`:
`create_booking`, `mark_booking_paid`, `cancel_booking`, `confirm_booking`,
dan `release_expired_bookings`. RPC berjalan sebagai owner fungsi sehingga
tidak membutuhkan grant tulis tabel bagi pemanggil.

Efeknya:

- direct `POST/PATCH/DELETE /rest/v1/bookings` ditolak di lapisan grant;
- kalaupun grant tidak sengaja diberikan lagi, tidak ada policy tulis yang
  cocok;
- organizer tetap dapat membaca semua booking lewat policy `SELECT`;
- tenant tetap hanya membaca booking sendiri.

## 4. RPC tulis dan anon

Empat RPC tulis mencabut `EXECUTE` dari `PUBLIC` dan `anon`, lalu memberi
`EXECUTE` hanya ke `authenticated`. Sebelumnya anon dapat mencapai badan fungsi
dan menerima `SWY_AUTH_REQUIRED`; sekarang anon ditolak lebih awal dengan
`permission denied for function`.

`release_expired_bookings()` sengaja tetap dapat dipanggil `anon`. Halaman
`/event` dan `/event/:id` bersifat publik dan memanggil sweep saat dibuka.
Fungsi ini hanya membatalkan booking yang sudah kedaluwarsa dan melepas booth;
tidak membocorkan data dan tidak menerima parameter. Risiko penyalahgunaan
adalah beban kerja sweep berulang, bukan perubahan data yang tidak sah. Ini
tetap dicatat sebagai F3 (rendah).

`current_user_role()` juga tetap dapat dipanggil anon/authenticated karena
policy membutuhkannya. Fungsi ini hanya mengembalikan role pemanggil.

## 5. Default privilege untuk objek baru

Migrasi ini memperbaiki objek yang sudah ada. Project Supabase masih dapat
memberi grant default kepada objek baru yang dibuat di schema `public` pada
masa depan. Setiap migrasi baru yang membuat tabel harus:

1. mengaktifkan RLS;
2. menulis policy yang disengaja;
3. memanggil `revoke` untuk operasi yang tidak dibutuhkan;
4. memberi grant minimum secara eksplisit.

Jangan mengandalkan default privilege. Kandidat hardening lanjutan (belum
diterapkan karena berisiko memutus migrasi/alat lain):

```sql
-- Contoh untuk database yang dikelola sendiri. Uji di staging lebih dulu.
alter default privileges in schema public
  revoke insert, update, delete, truncate on tables from anon;
```

Default privilege Supabase dikelola per role pembuat objek dan dapat berubah
antar versi platform. Verifikasi dengan kueri di bagian 6 sebelum menerapkan
perubahan default.

## 6. Verifikasi

`supabase/tests/rls_matrix.sql` bagian 2 memeriksa grant minimum dengan
`has_table_privilege` dan `has_function_privilege`. Bagian 9 (RLS-15) sekarang
**gagal** bila organizer masih dapat `UPDATE bookings` langsung.

Kueri katalog manual:

```sql
-- Grant tabel
select grantee, table_name, privilege_type
  from information_schema.role_table_grants
 where table_schema = 'public'
   and table_name in ('booths', 'blueprints', 'bookings')
   and grantee in ('anon', 'authenticated')
 order by table_name, grantee, privilege_type;

-- Grant fungsi
select r.routine_name, g.grantee, g.privilege_type
  from information_schema.routine_privileges g
  join information_schema.routines r
    on r.specific_name = g.specific_name
 where r.routine_schema = 'public'
   and r.routine_name in (
     'create_booking', 'mark_booking_paid', 'cancel_booking',
     'confirm_booking', 'release_expired_bookings', 'current_user_role'
   )
   and g.grantee in ('anon', 'authenticated', 'PUBLIC')
 order by r.routine_name, g.grantee;
```

Ekspektasi:

- `anon` hanya `SELECT` pada `booths`/`blueprints`; tidak ada baris untuk
  `bookings`.
- `authenticated` hanya `SELECT` pada `bookings`.
- `authenticated` memiliki `SELECT/INSERT/UPDATE/DELETE` pada
  `booths`/`blueprints`, tanpa `TRUNCATE`.
- `anon` tidak memiliki `EXECUTE` pada empat RPC tulis.
- `anon` dan `authenticated` memiliki `EXECUTE` pada
  `release_expired_bookings` dan `current_user_role`.

Uji REST manual:

```bash
# Harus 401/403 atau 0 baris.
curl -X PATCH "$SUPABASE_URL/rest/v1/bookings?id=eq.<id>" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ORGANIZER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"status":"confirmed"}'

# Harus permission denied, bukan SWY_AUTH_REQUIRED.
curl -X POST "$SUPABASE_URL/rest/v1/rpc/create_booking" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"p_booth_id":"<uuid>","p_payment_method":"va"}'
```

## 7. Rollback

Rollback membuka kembali F5. Utamakan forward fix.

Bila terpaksa:

```sql
-- Kembalikan policy organizer FOR ALL.
drop policy if exists "Organizers can manage bookings" on public.bookings;
create policy "Organizers can manage bookings"
  on public.bookings
  for all
  to authenticated
  using (public.current_user_role() = 'organizer')
  with check (public.current_user_role() = 'organizer');

-- Kembalikan grant tulis default (tidak disarankan).
grant insert, update, delete, truncate on table public.bookings to authenticated;
grant all on table public.bookings to anon;

grant execute on function public.create_booking(uuid, text) to anon;
grant execute on function public.mark_booking_paid(uuid) to anon;
grant execute on function public.cancel_booking(uuid) to anon;
grant execute on function public.confirm_booking(uuid) to anon;
```

Setelah rollback, pantau `bookings` dan jalankan ulang RLS-15 untuk memastikan
risiko yang diterima. Jangan rollback `release_expired_bookings` atau
`current_user_role`; keduanya dibutuhkan aplikasi.

## 8. Batasan lokal

Mesin pengembangan ini tidak memiliki `psql`, Supabase CLI, Docker, atau
kredensial staging. Karena itu:

- migrasi belum diterapkan ke Postgres nyata;
- kueri `information_schema` dan uji REST belum dijalankan;
- RLS-15 dan RLS-11 versi grant belum diverifikasi di staging.

Yang sudah diverifikasi lokal adalah `npm run verify` (lint, format, typecheck,
unit test, build, budget). Verifikasi grant menunggu OPS-04.

## 9. Referensi

- `supabase/RLS_MATRIX.md` (F1, F3, F5)
- `supabase/AUTH_ROLES.md` (helper role BE-07)
- `supabase/MIGRATIONS.md` (urutan dan rollback)
- `supabase/tests/rls_matrix.sql` bagian 2 dan 9
- `qa_checklist_test_plan.md` (RLS-11, RLS-15)
