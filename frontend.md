Panduan Pengembangan Front-End: Platform Booking Booth "sewa-yuk"
Dokumen ini memuat spesifikasi arsitektur antarmuka, manajemen state, dan pedoman desain untuk pengembangan Single Page Application (SPA) menggunakan kerangka Vite dan TypeScript yang telah diinisialisasi pada repositori.

1. Tumpukan Teknologi (Tech Stack)
Framework Dasar: Vite + React + TypeScript.

Routing: react-router-dom (Pemisahan rute /admin dan /event/:id).

Styling: Tailwind CSS (via PostCSS diintegrasikan pada src/style.css).

State Management: Zustand (fokus pada performa rendering spasial).

Drag-and-Drop: @dnd-kit/core (untuk dashboard tata letak admin).

BaaS & Realtime: @supabase/supabase-js.

2. Struktur Direktori Klien
Kembangkan repositori dari struktur dasar src/main.ts menjadi hierarki berikut:

src/components/ui/ - Komponen desain sistem (Tombol, Card, Dropdown).

src/components/map/ - Komponen InteractiveMap.tsx dan BoothRect.tsx (SVG).

src/pages/ - Halaman utama (AdminDashboard.tsx, EventTenant.tsx).

src/store/ - Penyimpanan logika Zustand (useBoothStore.ts).

src/lib/ - Konfigurasi pihak ketiga (supabase.ts, utilitas util).

3. Manajemen State Spasial (Zustand)
Gunakan Zustand untuk mengelola objek koordinat guna menghindari render ulang yang tidak perlu pada hierarki komponen yang tidak terkait.

TypeScript
// src/store/useBoothStore.ts
import { create } from 'zustand';

interface Booth {
  id: string;
  blueprintId: string;
  category: 'Tech' | 'F&B' | 'Apparel';
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  price: number;
  status: 'Available' | 'Reserved' | 'Booked';
}

interface BoothStore {
  booths: Booth[];
  activeBoothId: string | null;
  setBooths: (booths: Booth[]) => void;
  updateBoothPosition: (id: string, x: number, y: number) => void;
  setActiveBooth: (id: string | null) => void;
}

export const useBoothStore = create<BoothStore>((set) => ({
  booths: [],
  activeBoothId: null,
  setBooths: (booths) => set({ booths }),
  updateBoothPosition: (id, x, y) => set((state) => ({
    booths: state.booths.map(b => b.id === id ? { ...b, positionX: x, positionY: y } : b)
  })),
  setActiveBooth: (id) => set({ activeBoothId: id }),
}));
4. Render Kanvas SVG Interaktif
Sisi Admin: Implementasikan <DndContext> dari @dnd-kit/core membungkus area <svg>. Tangkap event onDragEnd untuk memperbarui positionX dan positionY di dalam Zustand store.

Sisi Penyewa: Render array booths menjadi elemen <rect>. Terapkan atribut rx="8" pada <rect> untuk konsistensi desain sudut melengkung.

Interaktivitas: Ikatkan fungsi onClick pada setiap elemen <rect> yang memanggil setActiveBooth(id). Nilai activeBoothId yang berubah akan otomatis memicu sidebar untuk menampilkan detail booth yang dipilih.

5. Arah Visual dan Sistem Desain
Buat antarmuka terasa seperti katalog acara dan alat kerja operator, bukan template dashboard generik. Peta booth adalah konten utama; informasi acara, kapasitas, harga, dan status membantu pengguna mengambil keputusan. Gunakan ruang kosong dan hierarki yang jelas, bukan dekorasi atau kartu untuk setiap potongan informasi.

Karakter visual:

- Gunakan dasar warna hangat seperti `#F7F6F2`, teks gelap `#222923`, hijau pinus `#285C4D` sebagai warna aksi, dan terracotta `#C66B4E` sebagai aksen terbatas. Simpan abu-abu netral untuk garis dan informasi sekunder. Definisikan warna sebagai token CSS agar konsisten dan mudah disesuaikan.
- Hindari gradien dekoratif, blur/glassmorphism, bayangan tebal, ikon emoji, dan warna neon. Jangan menerapkan satu warna aksen pada semua elemen; gunakan warna untuk tindakan utama dan petunjuk status saja.
- Gunakan sans-serif yang mudah dibaca untuk UI. Buat judul acara lebih ekspresif lewat ukuran dan bobot, bukan banyak jenis font. Gunakan angka tabular untuk harga dan ukuran booth bila tersedia.
- Pakai radius kecil hingga sedang secara konsisten (sekitar 6–10 px). Bedakan permukaan dengan garis tipis dan jarak; jangan membungkus setiap bagian dalam card bulat. Bayangan hanya untuk menu mengambang atau dialog yang memang berada di atas konten.

Komposisi halaman:

- Halaman penyewa menampilkan identitas acara dan lokasi/tanggal di bagian atas, lalu peta sebagai fokus utama. Letakkan legenda status, kontrol zoom, dan ringkasan pilihan dekat dengan peta. Detail booth yang dipilih muncul dalam panel ringkas dengan ukuran, kategori, harga, dan tombol pemesanan yang jelas.
- Dashboard admin mengutamakan nama acara, ringkasan angka yang benar-benar berguna, lalu kanvas tata letak dengan kontrol edit yang mudah ditemukan. Pisahkan aksi berisiko seperti menghapus booth dari aksi rutin dan minta konfirmasi sebelum menghapus.
- Batasi lebar teks panjang, gunakan alignment dan jarak yang konsisten, serta hindari KPI, grafik, atau label yang tidak membantu alur pemesanan/pengelolaan.

Peta dan status booth:

- Pertahankan denah sebagai satu bidang yang mudah dipindai; tampilkan nomor/nama booth bila ruang mencukupi dan jangan mengandalkan warna saja untuk menyampaikan status.
- Bedakan status dengan kombinasi warna, label/legenda, dan keadaan interaksi. Contoh: tersedia memakai permukaan terang dan outline hijau; dipilih memakai outline lebih tebal serta indikator pilihan; dipesan memakai abu-abu dan label nonaktif. Pastikan kontras tetap cukup dan status terbaca tanpa hover.
- Gunakan `cursor-pointer` untuk booth yang dapat dipilih. Booth yang tidak tersedia tetap dapat menampilkan alasan/status, tetapi tidak menawarkan aksi pemesanan.
- Sediakan indikator pilihan yang tetap terlihat, tooltip atau panel detail yang juga bisa dibuka dengan keyboard, serta label/legenda yang cocok dengan data sebenarnya.

Interaksi, responsif, dan aksesibilitas:

- Gunakan transisi singkat hanya untuk perubahan yang membantu orientasi (misalnya pilihan booth atau pembukaan panel). Hindari animasi berulang dan efek hover yang menggeser tata letak.
- Pada layar sempit, sediakan kontrol peta yang dapat dijangkau, panel detail yang berubah menjadi drawer atau bagian di bawah peta, dan ringkasan harga yang tetap terlihat tanpa menutupi denah.
- Semua tindakan harus bisa dijalankan dengan keyboard, memiliki fokus yang jelas, label aksesibel, dan target sentuh yang memadai. Jangan mengandalkan warna, hover, atau ikon tanpa teks sebagai satu-satunya petunjuk.
- Pertahankan kontras teks sesuai WCAG AA. Hormati `prefers-reduced-motion` dan tampilkan status loading, kosong, gagal, serta berhasil dengan pesan yang spesifik—bukan sekadar spinner atau perubahan warna.

6. Sinkronisasi Supabase Realtime
Karena arsitektur berjalan di sisi klien (CSR), penanganan bentrokan data harus dikelola dengan pendengar basis data langsung.

Inisialisasi saluran Supabase pada komponen layout utama atau di dalam Zustand.

Dengarkan event UPDATE pada tabel booths.

Saat payload diterima (misalnya pengguna lain mengklik "Checkout" dan status booth berubah menjadi Reserved), segera mutasi state booths di Zustand untuk meredupkan booth tersebut di layar pengguna saat ini, mencegah terjadinya pemesanan ganda.