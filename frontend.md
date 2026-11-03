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

5. Pedoman Desain Sistem (Universal Clean Modern)
Terapkan prinsip desain yang bersih, netral, dan mudah diakses (WCAG compliant) ke dalam Tailwind CSS.

Bentuk & Geometri: Hindari sudut tajam. Gunakan rounded-xl atau rounded-2xl untuk semua komponen card, menu, dan kanvas. Gunakan border tipis border border-gray-200.

Elevasi Visual: Gunakan shadow-sm untuk elemen statis dan shadow-md dengan transisi hover:shadow-lg untuk elemen interaktif guna menciptakan kedalaman spasial yang natural.

Tipografi: Gunakan font sans-serif berstandar tinggi (Inter, Roboto). Terapkan warna kontras tinggi text-gray-900 untuk teks primer dan text-gray-500 untuk label sekunder.

Warna Aksi Utama: Gunakan Trust Blue (bg-blue-600 dengan efek hover bg-blue-700) untuk tombol "Lanjutkan Pembayaran" dan booth yang sedang diklik.

Indikator Status (SVG Fills):

Available: Pengisian putih (fill-white), batas abu-abu lembut (stroke-gray-300).

Reserved/Booked: Pengisian abu-abu muda (fill-gray-100), kursor dimatikan (cursor-not-allowed).

6. Sinkronisasi Supabase Realtime
Karena arsitektur berjalan di sisi klien (CSR), penanganan bentrokan data harus dikelola dengan pendengar basis data langsung.

Inisialisasi saluran Supabase pada komponen layout utama atau di dalam Zustand.

Dengarkan event UPDATE pada tabel booths.

Saat payload diterima (misalnya pengguna lain mengklik "Checkout" dan status booth berubah menjadi Reserved), segera mutasi state booths di Zustand untuk meredupkan booth tersebut di layar pengguna saat ini, mencegah terjadinya pemesanan ganda.