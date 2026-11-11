# Dokumen Pengujian Kualitas (QA Checklist & Test Plan)
**Proyek:** sewa-yuk — Platform Booking Booth Event Interaktif 2D
**Versi:** 1.3.0
**Stack Utama:** Vite, React, TypeScript, Tailwind CSS, Zustand, Supabase (Auth, DB, Realtime), `@dnd-kit/core`
**Revisi terakhir:** 8 November 2026 — ditambah skenario hitungan waktu kedaluwarsa berjalan dan indikator koneksi realtime (TS-15), serta penyelarasan status dokumen dengan Fase 2.

---

## 1. Ringkasan & Tujuan
Dokumen ini disusun sebagai panduan pengujian menyeluruh (*End-to-End Testing*) untuk memastikan seluruh alur pengguna, keandalan sinkronisasi *real-time*, keamanan otentikasi, serta performa antarmuka spasial pada aplikasi **sewa-yuk** berfungsi sesuai spesifikasi sebelum dirilis ke lingkungan produksi.

---

## 2. Kriteria & Lingkungan Pengujian
* **Peramban Target:** Google Chrome (Desktop & Mobile), Mozilla Firefox, Apple Safari.
* **Resolusi Layar:** Mobile (375px - 430px), Tablet (768px - 1024px), Desktop (1280px+).
* **Kondisi Jaringan:** Fast 3G, 4G/WiFi, dan simulasi Offline/Latency tinggi.

### 2.1 Konvensi Status Booth
Status booth **selalu** disampaikan lewat kombinasi warna, pola, dan label teks—
jangan menilai hanya dari warna. Booth berstatus *Reserved*/*Booked* tetap dapat
diklik untuk diperiksa; hanya tombol pemesanan yang dinonaktifkan.

| Status | Tampilan di kanvas | Label teks | Bisa dipilih | Bisa dipesan |
| :--- | :--- | :--- | :---: | :---: |
| **Available** | Putih dengan garis tepi pine | Tersedia | Ya | Ya |
| **Reserved** | Abu-abu terang, garis putus-putus netral | Dipesan | Ya | Tidak |
| **Booked** | Abu-abu lebih gelap, garis netral | Terisi | Ya | Tidak |
| **Dipilih** | Isi pine + ikon centang | Tersedia/Dipesan/Terisi | — | Tergantung status |

---

## 3. Matriks Pengujian (Test Suites)

### TS-01: Otentikasi & Otorisasi (Supabase Auth & RLS)
| ID Skenario | Deskripsi Pengujian | Langkah Pengujian | Hasil yang Diharapkan | Status |
| :--- | :--- | :--- | :--- | :---: |
| **AUTH-01** | Login Admin dengan kredensial valid | Masukkan email & kata sandi akun organizer terdaftar -> klik "Masuk". | Berhasil masuk, sesi Supabase tersimpan, dan diarahkan ke `/admin` (dashboard organizer). Jika dibuka dari URL terproteksi, pengguna dikembalikan ke URL tersebut. | [ ] |
| **AUTH-02** | Login dengan kredensial salah | Masukkan email/password yang belum terdaftar atau salah. | Muncul notifikasi error (*toast*), form tidak di-submit, tetap di `/login`. | [ ] |
| **AUTH-03** | Proteksi Rute Private (`/admin/*`) | Akses `/admin/blueprint` secara langsung via URL tanpa login. | Otomatis di-redirect ke `/login`. Setelah login sebagai organizer, pengguna dikembalikan ke `/admin/blueprint`. | [ ] |
| **AUTH-04** | Logout Akun | Klik tombol "Keluar" di sisi kanan atas header (bukan di sidebar). | Sesi Supabase dihapus, data pengguna dibersihkan, dialihkan ke `/login`. | [ ] |
| **AUTH-05** | Tenant membuka rute organizer | Login sebagai tenant, lalu akses `/admin` atau `/admin/bookings` via URL. | Di-redirect ke `/event` (rute default tenant); halaman admin tidak pernah dirender. | [ ] |

---

### TS-02: Landing Page & Penjelajahan Publik
| ID Skenario | Deskripsi Pengujian | Langkah Pengujian | Hasil yang Diharapkan | Status |
| :--- | :--- | :--- | :--- | :---: |
| **LAND-01** | Responsivitas & Aksi CTA Utama | Klik tombol "Cari Lokasi Booth" pada Hero Section. | Mengarahkan pengguna dengan mulus ke daftar event di `/event` via SPA routing. | [ ] |
| **LAND-02** | Navigasi Header/Navbar | Klik logo "sewa-yuk" dan tombol "Masuk". | Logo mengarah ke `/`, tombol masuk mengarah ke `/login` via SPA routing. | [ ] |

---

### TS-03: Ruang Kerja Admin (Blueprint Editor - Drag-and-Drop)
| ID Skenario | Deskripsi Pengujian | Langkah Pengujian | Hasil yang Diharapkan | Status |
| :--- | :--- | :--- | :--- | :---: |
| **EDIT-01** | Drag booth baru ke kanvas | Drag ikon *booth* dari *sidebar* ke area SVG kanvas editor. | Elemen *booth* terpajang di posisi *drop*, koordinat `x, y` diperbarui di Zustand. | [ ] |
| **EDIT-02** | Pergeseran posisi booth di kanvas | Geser *booth* yang sudah ada ke lokasi lain di dalam kanvas. | Pergerakan *smooth*, posisi baru tercatat akurat tanpa tumpang tindih berlebih. | [ ] |
| **EDIT-03** | Simpan Denah ke Supabase | Klik tombol "Simpan Perubahan Denah". | Data array koordinat dikirim via API Supabase, muncul notifikasi sukses. | [ ] |
| **EDIT-04** | Form Metadata Booth | Klik salah satu *booth* lalu ubah harga & kategori di panel properties. | Nilai harga dan kategori pada *state* Zustand diperbarui seketika. | [ ] |

---

### TS-04: Kanvas Penyewa (Interactive SVG Map & Filter)
| ID Skenario | Deskripsi Pengujian | Langkah Pengujian | Hasil yang Diharapkan | Status |
| :--- | :--- | :--- | :--- | :---: |
| **MAP-01** | Render Peta SVG Interaktif | Buka halaman `/event/:eventId` penyewa. | Seluruh booth dirender sesuai koordinat DB dengan sudut melengkung (`rx="8"`), disertai label kategori, status, dan harga. | [ ] |
| **MAP-02** | Diferensiasi Visual Status | Amati warna, pola garis, dan label teks tiap booth. | *Available*: putih dengan garis pine + teks "Tersedia". *Reserved*: abu-abu terang bergaris putus-putus + teks "Dipesan". *Booked*: abu-abu lebih gelap + teks "Terisi". Legenda status tampil di bawah peta. Status tidak boleh dibedakan hanya dari warna. | [ ] |
| **MAP-03** | Pemilihan Booth (`onClick`) | Klik salah satu booth, termasuk yang berstatus *Reserved* atau *Booked*. | Booth terpilih terisi warna pine dengan ikon centang (bukan outline biru); fokus keyboard memakai outline putus-putus clay. Panel detail di sisi kanan (desktop) atau di bawah peta (mobile) menampilkan kategori, harga, dimensi, dan status. Booth tidak tersedia tetap bisa diperiksa, tetapi tombol pemesanannya nonaktif. | [ ] |
| **MAP-04** | Filter Kategori Booth | Pilih filter "F&B", "Teknologi", atau "Pakaian" pada panel "Filter kategori" di samping peta. | Booth sesuai kategori tetap jelas, booth kategori lain meredup (opacity ±30%). Angka jumlah booth per kategori ikut menyesuaikan. | [ ] |

---

### TS-05: Checkout & Realtime Concurrency (Anti Double-Booking)
| ID Skenario | Deskripsi Pengujian | Langkah Pengujian | Hasil yang Diharapkan | Status |
| :--- | :--- | :--- | :--- | :---: |
| **SYNC-01** | Integrasi Supabase Realtime | Buka halaman peta event yang sama di 2 browser/tab terpisah (User A & User B). | Perubahan status booth pada User A langsung terlihat di layar User B tanpa reload. | [ ] |
| **SYNC-02** | Kunci Booth Saat Checkout | User A mengklik "Pesan booth ini" pada salah satu booth. | Status booth tersebut di layar User B berubah instan menjadi *Dipesan* (abu-abu, garis putus-putus). Booth masih bisa diklik untuk inspeksi, tetapi tombol pemesanan User B nonaktif. | [ ] |
| **SYNC-03** | Penanganan Pemesanan Bersamaan | User A & B menekan tombol bayar pada booth yang sama di milidetik mendekati sama. | Sistem hanya mengonfirmasi 1 transaksi, user lainnya menerima pesan peringatan. | [ ] |

---

### TS-06: Admin Dashboard & Inventaris
| ID Skenario | Deskripsi Pengujian | Langkah Pengujian | Hasil yang Diharapkan | Status |
| :--- | :--- | :--- | :--- | :---: |
| **DASH-01** | Kalkulasi Metrik Otomatis | Buka `/admin` (dashboard organizer). | Empat kartu ringkasan tampil sesuai angka asli DB: Total booth, Terisi, Tersedia (dengan info booth menunggu pembayaran), dan Estimasi pendapatan (nilai ringkas; nilai penuh terlihat pada tooltip). Angka mengikuti filter event yang dipilih. | [ ] |
| **DASH-02** | Tabel Manajemen Booth | Ubah status booth lewat dropdown status atau tombol aksi cepat di tabel inventaris, misalnya dari *Reserved* ke *Booked*. | Status ter-update di DB, muncul toast sukses, dan peta penyewa ikut menyesuaikan secara *real-time*. Tombol nonaktif sementara selama proses update. | [ ] |

---

### TS-07: Performa & Responsivitas Antarmuka
| ID Skenario | Deskripsi Pengujian | Langkah Pengujian | Hasil yang Diharapkan | Status |
| :--- | :--- | :--- | :--- | :---: |
| **PERF-01** | Rendering Canvas Zustand | Lakukan drag/pilih booth berulang kali sambil memantau DevTools React. | Re-render hanya terjadi pada komponen terisolasi, tidak ada lag/frame-drop. | [ ] |
| **RESP-01** | Tampilan Layar Ponsel | Buka halaman peta penyewa pada tampilan 375px (Mobile). | SVG dapat digeser/di-zoom (cubit, tombol zoom, atau Ctrl + scroll), legenda tetap terbaca, dan panel detail berpindah ke bawah peta (bukan *bottom sheet* melayang). Tombol pemesanan tetap dapat dijangkau tanpa scroll horizontal. | [ ] |

---

### TS-08: Publikasi, Visibilitas, dan Pengelolaan Denah
| ID Skenario | Deskripsi Pengujian | Langkah Pengujian | Hasil yang Diharapkan | Status |
| :--- | :--- | :--- | :--- | :---: |
| **BLP-01** | Publikasi denah draft | Login organizer -> `/admin/blueprint` -> buat denah + minimal 1 booth -> klik **Publikasikan**. | Badge berubah menjadi *Dipublikasikan*, toast sukses muncul, dan denah tampil di `/event`. Tenant dapat membuka `/event/:id` dan memesan booth. | [ ] |
| **BLP-02** | Unpublish / kembalikan ke draft | Dari `/admin/blueprint`, klik **Jadikan Draft** pada denah terpublikasi. | Denah hilang dari `/event`; akses langsung `/event/:id` sebagai tenant tidak menampilkan booth maupun data denah. REST API tenant untuk blueprint tersebut mengembalikan hasil kosong. | [ ] |
| **BLP-03** | Denah baru default draft | Buat denah baru lewat tombol **Buat Denah Baru**, isi nama dan ID valid. | Denah tersimpan sebagai `draft`, tidak terlihat di `/event`, tetapi muncul di `/admin/blueprint` dan dapat disusun booth-nya. | [ ] |
| **BLP-04** | Publish tanpa booth ditolak | Buat denah draft tanpa booth, lalu klik **Publikasikan**. | Muncul toast error "Tambahkan minimal satu booth…" dan status tetap `draft`. | [ ] |
| **BLP-05** | Edit nama, venue, tanggal | Klik **Edit Detail** pada kartu denah, ubah nama/venue/tanggal, lalu **Simpan Detail**. | Perubahan tersimpan di Supabase, kartu langsung diperbarui, dan tetap sama setelah halaman dimuat ulang. ID denah/URL tidak berubah. | [ ] |
| **BLP-06** | Hapus denah dengan konfirmasi inline | Klik **Hapus** pada denah tanpa booking aktif. | Panel `role="alertdialog"` muncul menyebut jumlah booth dan booking terkait. Tombol Batal menerima fokus awal, Escape menutup panel, dan konfirmasi menghapus denah beserta booth-nya. | [ ] |
| **BLP-07** | Hapus denah dengan booking aktif ditolak | Buat booking `pending`/`awaiting_confirmation`/`confirmed` pada denah, lalu coba hapus denah. | Penghapusan dibatalkan dan muncul pesan jelas berisi jumlah booking aktif. Denah, booth, dan booking tetap utuh. | [ ] |
| **BLP-08** | Hapus denah dengan riwayat booking selesai | Pastikan semua booking pada denah berstatus `cancelled`, lalu hapus denah. | Denah dan booth terhapus; baris booking tetap ada sebagai riwayat dengan `booth_id` menjadi `null`. | [ ] |

---

### TS-09: Penjelajahan Event — Filter & Pencarian
| ID Skenario | Deskripsi Pengujian | Langkah Pengujian | Hasil yang Diharapkan | Status |
| :--- | :--- | :--- | :--- | :---: |
| **EXPL-01** | Filter kategori | Buka `/event` lalu klik filter **F&B**, **Teknologi**, atau **Pakaian**. | Hanya event yang memiliki booth pada kategori terpilih yang tampil; tombol filter aktif memakai `aria-pressed="true"`; teks jumlah berubah menjadi `X dari Y acara`. | [ ] |
| **EXPL-02** | Pencarian nama/venue/deskripsi | Ketik kata kunci pada kolom **Cari nama event atau venue…**. | Daftar menyaring event secara case-insensitive berdasarkan nama, venue, deskripsi, atau kategori. Jumlah hasil ikut diperbarui. | [ ] |
| **EXPL-03** | Kombinasi pencarian + kategori | Pilih satu kategori lalu ketik kata kunci yang hanya cocok pada kategori lain. | Hasil kosong karena filter diterapkan bersamaan. Reset mengembalikan seluruh event. | [ ] |
| **EXPL-04** | Empty state pencarian | Ketik kata kunci yang tidak ada, misalnya `zzz-tidak-ada`. | Muncul pesan "Tidak ada event yang cocok…" dan tombol **Tampilkan semua acara** yang mereset pencarian dan kategori. | [ ] |
| **EXPL-05** | Aksesibilitas kolom pencarian | Gunakan Tab menuju kolom pencarian dan filter, lalu operasikan dengan keyboard. | Kolom memiliki label aksesibel, fokus terlihat, dan seluruh kontrol dapat dioperasikan tanpa mouse. | [ ] |

---

### TS-10: Siklus Booking Penyewa
| ID Skenario | Deskripsi Pengujian | Langkah Pengujian | Hasil yang Diharapkan | Status |
| :--- | :--- | :--- | :--- | :---: |
| **BOOK-01** | Buat booking | Login tenant -> `/event/:id` -> pilih booth `Available` -> **Pesan booth ini** -> pilih metode pembayaran -> konfirmasi. | Booking baru berstatus `pending` dengan kode `SWY-…` dan `expires_at` ±24 jam; booth berubah menjadi `Reserved` dan terlihat realtime di tab lain. | [ ] |
| **BOOK-02** | Tandai sudah bayar | Di `/bookings`, buka booking `pending` lalu klik aksi **Sudah Bayar**. | Status berubah menjadi `awaiting_confirmation`; instruksi pembayaran berhenti ditampilkan; organizer melihat booking di `/admin/bookings`. | [ ] |
| **BOOK-03** | Batalkan booking pending | Di `/bookings`, klik **Batalkan** pada booking `pending`, lalu konfirmasi lewat panel inline. | Status menjadi `cancelled`, booth kembali `Available`, dan perubahan terlihat realtime tanpa reload. Tombol Batal/Escape menutup panel tanpa mengubah data. | [ ] |
| **BOOK-04** | Batalkan booking menunggu verifikasi | Batalkan booking `awaiting_confirmation` dari `/bookings`. | Booking menjadi `cancelled`, booth kembali `Available`, dan riwayat pembatalan tetap tampil. | [ ] |
| **BOOK-05** | Booking confirmed tidak bisa dibatalkan tenant | Coba batalkan booking berstatus `confirmed`. | Aksi tidak tersedia atau ditolak dengan pesan jelas; status dan booth tidak berubah. | [ ] |
| **BOOK-06** | Instruksi pembayaran | Buka booking `pending` untuk setiap metode (`va`, `transfer`, `qris`). | Instruksi sesuai metode tampil lengkap, termasuk kode/VA dan batas waktu; tidak ada data sensitif yang bocor ke tenant lain. | [ ] |
| **BOOK-07** | Idempotensi buat booking (double submit) | Login tenant -> pilih booth `Available` -> klik konfirmasi pesanan dua kali cepat (atau kirim dua request `create_booking` paralel untuk booth dan pengguna yang sama). | Hanya satu baris booking dibuat; kedua respons menunjuk kode pesanan yang sama; booth tetap satu kali `Reserved`; tidak ada error mentah di UI. | [ ] |
| **BOOK-08** | Idempotensi tandai bayar & batal | Klik **Sudah Bayar** dua kali pada booking `pending`, lalu panggil ulang aksi batal pada booking yang sudah `cancelled` (mis. dua tab). | `mark_booking_paid` kedua mengembalikan status `awaiting_confirmation` tanpa error; `cancel_booking` kedua mengembalikan booking `cancelled` yang sama; tidak ada perubahan ganda pada booth. | [ ] |
| **BOOK-09** | Kontrak error RPC tampil spesifik | Picu kasus: booth diambil tenant lain, booking kedaluwarsa, booking sudah `confirmed`, dan booking milik tenant lain. | UI menampilkan pesan spesifik sesuai `supabase/ERROR_CONTRACT.md` (mis. "Booth sudah tidak tersedia…", "Pemesanan sudah kedaluwarsa…", "Pemesanan ini sudah dibayar…", "Anda tidak berhak…"), bukan pesan mentah PostgreSQL. | [ ] |

---

### TS-11: Verifikasi & Pembatalan Booking oleh Organizer
| ID Skenario | Deskripsi Pengujian | Langkah Pengujian | Hasil yang Diharapkan | Status |
| :--- | :--- | :--- | :--- | :---: |
| **ADM-01** | Verifikasi booking | Login organizer -> `/admin/bookings` -> cari booking `awaiting_confirmation` -> klik **Verifikasi**. | Status menjadi `confirmed`, booth terkait menjadi `Booked`, toast sukses muncul, dan perubahan terlihat realtime di halaman tenant. | [ ] |
| **ADM-02** | Tolak/batalkan booking | Pada booking `pending` atau `awaiting_confirmation`, klik **Batalkan** lalu konfirmasi lewat panel inline. | Status menjadi `cancelled`, booth kembali `Available`, dan tenant melihat status terbaru tanpa reload. Escape/Batal tidak mengubah data. | [ ] |
| **ADM-03** | Booking confirmed tidak dapat dibatalkan organizer | Coba batalkan booking `confirmed`. | Aksi ditolak dengan pesan jelas dan status tetap `confirmed` (sesuai aturan RPC `cancel_booking`). | [ ] |
| **ADM-04** | Filter dan pencarian booking | Gunakan filter status, filter event, dan kolom pencarian kode/nama/email tenant. | Hasil hanya menampilkan booking yang cocok; kombinasi filter bekerja bersamaan; empty state tampil jelas. | [ ] |
| **ADM-05** | Ringkasan metrik | Amati kartu ringkasan setelah verifikasi/pembatalan. | Jumlah menunggu verifikasi, pending, confirmed, dan estimasi pendapatan berubah sesuai data terbaru. | [ ] |
| **ADM-06** | Idempotensi verifikasi organizer | Klik **Verifikasi** dua kali pada booking yang sama (atau dari dua tab organizer). | `confirm_booking` kedua mengembalikan booking `confirmed` yang sama; booth tetap `Booked`; metrik tidak bertambah ganda; toast tidak menampilkan error. | [ ] |

---

### TS-12: Gambar Denah (Upload & Hapus)
| ID Skenario | Deskripsi Pengujian | Langkah Pengujian | Hasil yang Diharapkan | Status |
| :--- | :--- | :--- | :--- | :---: |
| **IMG-01** | Upload gambar valid | Di editor denah, unggah `PNG`/`JPEG`/`WebP` berukuran < 5 MB, lalu simpan denah. | Pratinjau tampil, file tersimpan di bucket `blueprint-assets`, `image_url`/`image_path` terisi, dan gambar muncul di `/event` serta kartu `/admin/blueprint`. | [ ] |
| **IMG-02** | Tolak file tidak valid | Coba unggah file > 5 MB atau tipe selain gambar yang diizinkan. | Upload ditolak dengan pesan jelas; gambar lama tidak berubah. | [ ] |
| **IMG-03** | Ganti gambar | Unggah gambar baru lalu simpan. | Metadata menunjuk ke gambar baru dan file lama di Storage dihapus setelah penyimpanan berhasil. | [ ] |
| **IMG-04** | Hapus gambar | Hapus gambar lewat kontrol uploader lalu simpan. | `image_url`/`image_path` menjadi `null`, kartu memakai placeholder denah, dan file di Storage terhapus. | [ ] |
| **IMG-05** | Gagal upload tidak merusak data | Simulasikan jaringan gagal saat upload atau simpan. | Muncul pesan error, denah/booth lama tetap utuh, dan tidak ada file yatim baru. | [ ] |

---

### TS-13: Negative Test RLS & Otorisasi Database
| ID Skenario | Deskripsi Pengujian | Langkah Pengujian | Hasil yang Diharapkan | Status |
| :--- | :--- | :--- | :--- | :---: |
| **RLS-01** | Tenant membuka rute organizer | Login tenant lalu akses `/admin`, `/admin/bookings`, dan `/admin/blueprint` via URL. | Dialihkan ke `/event`; tidak ada halaman admin yang dirender. | [ ] |
| **RLS-02** | Tenant membaca blueprint draft | Dengan JWT tenant, panggil REST `GET /rest/v1/blueprints?id=eq.<draft-id>` memakai anon key + `Authorization: Bearer <tenant-jwt>`. | Respons `200` dengan array kosong (atau `404`), bukan data draft. | [ ] |
| **RLS-03** | Anon mencoba update booth | Dengan anon key tanpa login, panggil `PATCH /rest/v1/booths?id=eq.<booth-id>` untuk mengubah `status`. | Ditolak `401/403` atau tidak ada baris yang terubah; status booth di DB tetap. | [ ] |
| **RLS-04** | Anon mencoba insert booth | Dengan anon key, panggil `POST /rest/v1/booths`. | Ditolak `401/403`; tidak ada booth baru. | [ ] |
| **RLS-05** | Tenant mengubah booking milik orang lain | Dengan JWT tenant A, panggil RPC `cancel_booking` memakai ID booking tenant B. | Ditolak dengan pesan "Anda tidak berhak…" dan booking tenant B tidak berubah. | [ ] |
| **RLS-06** | Anon membaca booking | Dengan anon key, panggil `GET /rest/v1/bookings`. | Ditolak atau mengembalikan array kosong; tidak ada data tenant yang bocor. | [ ] |

---

### TS-14: Booking Expiry / Auto-Release
| ID Skenario | Deskripsi Pengujian | Langkah Pengujian | Hasil yang Diharapkan | Status |
| :--- | :--- | :--- | :--- | :---: |
| **EXP-01** | Sweep booking kedaluwarsa | Buat booking `pending`, lalu di SQL Editor set `expires_at = now() - interval '1 minute'`, kemudian buka `/bookings` atau klik **Perbarui status**. | Booking menjadi `cancelled` dengan `cancelled_reason='expired'`; booth terkait kembali `Available` dan perubahan terlihat realtime. | [ ] |
| **EXP-02** | Tampilan kedaluwarsa | Amati booking yang sudah melewati `expires_at` sebelum/sesudah sweep. | Badge **Kedaluwarsa** tampil, tombol bayar nonaktif, dan instruksi pembayaran tidak lagi ditawarkan. | [ ] |
| **EXP-03** | Bayar setelah kedaluwarsa ditolak | Panggil `mark_booking_paid` pada booking `pending` yang sudah lewat `expires_at`. | RPC menolak dengan pesan jelas; status booking tidak berubah menjadi `awaiting_confirmation`. | [ ] |
| **EXP-04** | Verifikasi setelah kedaluwarsa ditolak | Panggil `confirm_booking` pada booking `pending` yang sudah lewat `expires_at`. | RPC menolak dan booth tidak berubah menjadi `Booked`. | [ ] |
| **EXP-05** | Sweep bersamaan aman | Jalankan `release_expired_bookings()` dua kali bersamaan pada data yang sama. | Tidak ada error race condition/duplikasi; hanya satu proses yang mengubah booking dan melepas booth. | [ ] |
| **EXP-06** | Hitungan waktu berjalan tanpa reload | Buat booking `pending` dengan `expires_at` sekitar 2 menit ke depan, lalu buka `/bookings` dan amati teks **Sisa HH:MM:SS** tanpa menyentuh halaman. | Hitungan berkurang tiap detik. Saat mencapai nol, badge berubah menjadi **Kedaluwarsa**, sweep otomatis berjalan sekali, booking menjadi `cancelled` dengan `cancelled_reason='expired'`, dan booth kembali `Available` tanpa reload manual. | [ ] |
| **EXP-07** | Hitungan berhenti setelah tandai bayar | Tandai booking `pending` sebagai **Sudah Bayar**, lalu amati batas pembayaran dan tunggu hingga `expires_at` terlewat. | Baris batas pembayaran tetap menampilkan tanggal, tetapi teks **Sisa** tidak lagi muncul. Booking tetap `awaiting_confirmation` dan tidak ikut dibatalkan oleh sweep karena menunggu verifikasi organizer. | [ ] |

---

### TS-15: Indikator Koneksi Realtime
| ID Skenario | Deskripsi Pengujian | Langkah Pengujian | Hasil yang Diharapkan | Status |
| :--- | :--- | :--- | :--- | :---: |
| **CONN-01** | Status awal menghubungkan lalu live | Buka `/event/:eventId`, `/bookings`, atau `/admin/bookings` dengan koneksi normal. | Badge sempat menampilkan **Menghubungkan…**, lalu berubah menjadi **Sinkron real-time** tanpa reload. Badge memakai `role="status"` dan `aria-live="polite"`. | [ ] |
| **CONN-02** | Koneksi terputus | Saat halaman terbuka, putuskan jaringan lewat DevTools (Offline) atau matikan Wi-Fi hingga channel realtime gagal. | Badge berubah menjadi **Koneksi terputus** disertai teks **Terakhir diperbarui HH:MM** (atau **Belum ada pembaruan** bila belum pernah ada data) dan tombol **Muat ulang data**. Perubahan realtime berhenti masuk, tetapi data yang sudah tampil tetap terbaca. | [ ] |
| **CONN-03** | Muat ulang data manual | Pada kondisi **Koneksi terputus**, klik tombol **Muat ulang data** menggunakan mouse dan keyboard. | Tombol menampilkan **Memuat…** dan nonaktif selama proses, lalu data dimuat ulang dan tombol aktif kembali. Fokus keyboard terlihat dan tidak berpindah ke elemen tak terduga. | [ ] |
| **CONN-04** | Pulih setelah koneksi kembali | Sambungkan kembali jaringan dan tunggu beberapa detik tanpa reload halaman. | Badge kembali menjadi **Sinkron real-time**, perubahan booth/booking dari tab lain kembali terlihat, dan tombol muat ulang hilang. Indikator tidak mengandalkan warna saja karena label teksnya selalu tampil. | [ ] |

---

## 4. Templat Pelaporan Bug (Bug Report Template)

Jika ditemukan ketidaksesuaian saat pengujian, gunakan format laporan berikut:

```text
[ID BUG]: BUG-00X
[Judul]: (Misal: Status Booth tidak berubah secara realtime di Safari)
[Komponen]: InteractiveMap / Supabase Realtime / Zustand
[Keparahan]: Critical / Major / Minor / Cosmetic
[Langkah Reproduksi]:
  1. Buka halaman event di browser Safari.
  2. Lakukan transaksi dari browser Chrome.
  3. Amati layar Safari.
[Hasil Aktual]: Booth di Safari masih tampil "Tersedia" dengan garis tepi pine.
[Hasil Diharapkan]: Booth di Safari berubah menjadi "Dipesan" (abu-abu, garis putus-putus) tanpa reload.
[Bukti]: (Lampirkan screenshot/video rekaman layar)
```