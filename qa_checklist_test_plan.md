# Dokumen Pengujian Kualitas (QA Checklist & Test Plan)
**Proyek:** sewa-yuk — Platform Booking Booth Event Interaktif 2D  
**Versi:** 1.0.0  
**Stack Utama:** Vite, React, TypeScript, Tailwind CSS, Zustand, Supabase (Auth, DB, Realtime), `@dnd-kit/core`

---

## 1. Ringkasan & Tujuan
Dokumen ini disusun sebagai panduan pengujian menyeluruh (*End-to-End Testing*) untuk memastikan seluruh alur pengguna, keandalan sinkronisasi *real-time*, keamanan otentikasi, serta performa antarmuka spasial pada aplikasi **sewa-yuk** berfungsi sesuai spesifikasi sebelum dirilis ke lingkungan produksi.

---

## 2. Kriteria & Lingkungan Pengujian
* **Peramban Target:** Google Chrome (Desktop & Mobile), Mozilla Firefox, Apple Safari.
* **Resolusi Layar:** Mobile (375px - 430px), Tablet (768px - 1024px), Desktop (1280px+).
* **Kondisi Jaringan:** Fast 3G, 4G/WiFi, dan simulasi Offline/Latency tinggi.

---

## 3. Matriks Matriks Pengujian (Test Suites)

### TS-01: Otentikasi & Otorisasi (Supabase Auth & RLS)
| ID Skenario | Deskripsi Pengujian | Langkah Pengujian | Hasil yang Diharapkan | Status |
| :--- | :--- | :--- | :--- | :---: |
| **AUTH-01** | Login Admin dengan kredensial valid | Masukkan email & kata sandi admin terdaftar -> klik "Masuk". | Berhasil masuk, token JWT disimpan, dialihkan ke `/admin/dashboard`. | [ ] |
| **AUTH-02** | Login dengan kredensial salah | Masukkan email/password yang belum terdaftar atau salah. | Muncul notifikasi error (*toast*), form tidak di-submit, tetap di `/login`. | [ ] |
| **AUTH-03** | Proteksi Rute Private (`/admin/*`) | Akses `/admin/blueprint` secara langsung via URL tanpa login. | Otomatis di-redirect kembali ke halaman `/login`. | [ ] |
| **AUTH-04** | Logout Akun | Klik tombol "Logout" pada *sidebar* admin. | Sesi Supabase dihapus, token dibersihkan, dialihkan ke halaman utama/login. | [ ] |

---

### TS-02: Landing Page & Penjelajahan Publik
| ID Skenario | Deskripsi Pengujian | Langkah Pengujian | Hasil yang Diharapkan | Status |
| :--- | :--- | :--- | :--- | :---: |
| **LAND-01** | Responsivitas & Aksi CTA Utama | Klik tombol "Cari Lokasi Booth" pada Hero Section. | Mengarahkan pengguna dengan mulus ke daftar event (`/events`). | [ ] |
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
| **MAP-01** | Render Peta SVG Interaktif | Buka halaman `/event/:id` penyewa. | Seluruh booth dirender sesuai koordinat DB dengan sudut melengkung (`rx="8"`). | [ ] |
| **MAP-02** | Diferensiasi Visual Status | Amati warna elemen `<rect>` tiap status booth. | *Available* (Putih/Hijau), *Reserved* (Kuning), *Booked* (Abu-abu *disabled*). | [ ] |
| **MAP-03** | Pemilihan Booth (`onClick`) | Klik elemen booth berstatus *Available*. | Booth tersorot (outline biru), sidebar kanan menampilkan detail lengkap. | [ ] |
| **MAP-04** | Filter Kategori Booth | Pilih filter "F&B" atau "Tech" di bagian header penyewa. | Booth sesuai kategori tetap cerah, booth kategori lain meredup (*dimmed*). | [ ] |

---

### TS-05: Checkout & Realtime Concurrency (Anti Double-Booking)
| ID Skenario | Deskripsi Pengujian | Langkah Pengujian | Hasil yang Diharapkan | Status |
| :--- | :--- | :--- | :--- | :---: |
| **SYNC-01** | Integrasi Supabase Realtime | Buka halaman peta event yang sama di 2 browser/tab terpisah (User A & User B). | Perubahan data pada User A langsung merefleksi di layar User B tanpa reload. | [ ] |
| **SYNC-02** | Kunci Booth Saat Checkout | User A mengklik "Pesan Sekarang" pada Booth #12. | Status Booth #12 di layar User B berubah instan jadi *Reserved* & tidak bisa diklik. | [ ] |
| **SYNC-03** | Penanganan Pemesanan Bersamaan | User A & B menekan tombol bayar pada booth yang sama di milidetik mendekati sama. | Sistem hanya mengonfirmasi 1 transaksi, user lainnya menerima pesan peringatan. | [ ] |

---

### TS-06: Admin Dashboard & Inventaris
| ID Skenario | Deskripsi Pengujian | Langkah Pengujian | Hasil yang Diharapkan | Status |
| :--- | :--- | :--- | :--- | :---: |
| **DASH-01** | Kalkulasi Metrik Otomatis | Buka `/admin/dashboard`. | Kartu Total Booth, Booked, Available, & Estimasi Revenue sesuai angka asli DB. | [ ] |
| **DASH-02** | Tabel Manajemen Booth | Ubah status booth secara manual di tabel dari *Reserved* ke *Booked*. | Status ter-update di DB, peta penyewa langsung menyesuaikan secara *real-time*. | [ ] |

---

### TS-07: Performa & Responsivitas Antarmuka
| ID Skenario | Deskripsi Pengujian | Langkah Pengujian | Hasil yang Diharapkan | Status |
| :--- | :--- | :--- | :--- | :---: |
| **PERF-01** | Rendering Canvas Zustand | Lakukan drag/pilih booth berulang kali sambil memantau DevTools React. | Re-render hanya terjadi pada komponen terisolasi, tidak ada lag/frame-drop. | [ ] |
| **RESP-01** | Tampilan Layar Ponsel | Buka halaman peta penyewa pada tampilan 375px (Mobile). | SVG dapat digeser/zoom, panel detail berubah menjadi modul *bottom sheet*. | [ ] |

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
[Hasil Aktual]: Booth di Safari tetap berwarna hijau.
[Hasil Diharapkan]: Booth di Safari berubah otomatis menjadi abu-abu (Booked).
[Bukti]: (Lampirkan screenshot/video rekaman layar)
```