# Dokumen Pengujian Kualitas (QA Checklist & Test Plan)
**Proyek:** sewa-yuk — Platform Booking Booth Event Interaktif 2D
**Versi:** 1.1.0
**Stack Utama:** Vite, React, TypeScript, Tailwind CSS, Zustand, Supabase (Auth, DB, Realtime), `@dnd-kit/core`
**Revisi terakhir:** 4 November 2026 — disinkronkan dengan route, warna, dan lokasi kontrol aktual (commit `a1afc25`).

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