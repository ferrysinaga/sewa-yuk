export type Category = 'Tech' | 'F&B' | 'Apparel'
export type BoothStatus = 'Available' | 'Reserved' | 'Booked'

export interface Booth {
  id: string
  label: string
  category: Category
  price: number
  size: string
  note: string
  x: number
  y: number
  width: number
  height: number
  status: BoothStatus
}

export const MAP_WIDTH = 520
export const MAP_HEIGHT = 400
export const MIN_ZOOM = 1
export const MAX_ZOOM = 2

export const booths: Booth[] = [
  {
    id: 'A-01',
    label: 'Booth A-01',
    category: 'Tech',
    price: 4500000,
    size: '3 × 3 m',
    note: 'Sayap kiri · dekat aisle utama',
    x: 24,
    y: 64,
    width: 120,
    height: 76,
    status: 'Available',
  },
  {
    id: 'A-02',
    label: 'Booth A-02',
    category: 'F&B',
    price: 3800000,
    size: '3 × 3 m',
    note: 'Sayap kiri · dekat area makanan',
    x: 24,
    y: 152,
    width: 120,
    height: 76,
    status: 'Available',
  },
  {
    id: 'A-03',
    label: 'Booth A-03',
    category: 'Apparel',
    price: 3200000,
    size: '3 × 3 m',
    note: 'Sayap kiri · dekat area fashion',
    x: 24,
    y: 240,
    width: 120,
    height: 76,
    status: 'Booked',
  },
  {
    id: 'A-04',
    label: 'Booth A-04',
    category: 'Tech',
    price: 2900000,
    size: '2 × 3 m',
    note: 'Sayap kiri · dekat pintu masuk',
    x: 24,
    y: 320,
    width: 120,
    height: 64,
    status: 'Available',
  },
  {
    id: 'B-01',
    label: 'Booth B-01',
    category: 'F&B',
    price: 6200000,
    size: '4 × 3 m',
    note: 'Area tengah · posisi premium',
    x: 300,
    y: 64,
    width: 196,
    height: 88,
    status: 'Available',
  },
  {
    id: 'B-02',
    label: 'Booth B-02',
    category: 'Tech',
    price: 7400000,
    size: '4 × 3 m',
    note: 'Area tengah · paling strategis',
    x: 300,
    y: 164,
    width: 196,
    height: 88,
    status: 'Available',
  },
  {
    id: 'B-03',
    label: 'Booth B-03',
    category: 'Apparel',
    price: 5100000,
    size: '4 × 3 m',
    note: 'Area tengah · dekat pintu masuk',
    x: 300,
    y: 264,
    width: 196,
    height: 88,
    status: 'Reserved',
  },
]

export const categoryFilters: Array<{ value: Category | 'all'; label: string }> = [
  { value: 'all', label: 'Semua' },
  { value: 'Tech', label: 'Teknologi' },
  { value: 'F&B', label: 'F&B' },
  { value: 'Apparel', label: 'Pakaian' },
]

export const navItems = [
  { label: 'Acara', href: '#acara' },
  { label: 'Cara kerja', href: '#cara-kerja' },
  { label: 'Penyelenggara', href: '#penyelenggara' },
]

export const events = [
  {
    id: 'hall-a',
    title: 'Pameran Teknologi Nusantara 2026',
    venue: 'Jakarta Convention Center · Hall A',
    day: '12–15',
    month: 'Mar 2026',
    category: 'Teknologi',
    available: 42,
    total: 120,
  },
  {
    id: 'hall-b',
    title: 'Festival Kuliner Merdeka',
    venue: 'Grand City Convention · Hall B',
    day: '2–5',
    month: 'Apr 2026',
    category: 'F&B',
    available: 18,
    total: 90,
  },
  {
    id: 'hall-5',
    title: 'Indonesia Fashion Week',
    venue: 'ICE BSD · Hall 5',
    day: '21–26',
    month: 'Apr 2026',
    category: 'Pakaian',
    available: 31,
    total: 140,
  },
]

export const values = [
  {
    title: 'Lokasi terbaca sebelum bayar',
    description:
      'Lihat posisi booth terhadap pintu masuk, lorong utama, dan booth tetangga. Bandingkan ukuran serta harga tanpa menebak.',
  },
  {
    title: 'Status tidak pernah tertinggal',
    description:
      'Booth yang baru dikunci langsung berubah di layar semua orang, sehingga tidak ada dua penyewa yang merasa memegang lokasi yang sama.',
  },
  {
    title: 'Satu denah untuk semua',
    description:
      'Penyelenggara menyusun tata letak, penyewa membaca denah yang sama. Perubahan langsung tersaji tanpa file gambar terpisah.',
  },
]

export const organizerPoints = [
  'Seret booth di kanvas dengan bantuan grid',
  'Atur kategori, harga, dan dimensi tiap booth',
  'Publikasikan denah ke halaman penyewa',
]

export const tenantPoints = [
  'Sorot booth sesuai kategori dan kebutuhan',
  'Buka detail lewat klik atau navigasi keyboard',
  'Kunci posisi secara real-time sebelum diambil',
]

export const steps = [
  {
    title: 'Pilih acara',
    description: 'Buka acara yang masih menerima penyewa, lalu periksa tanggal dan lokasinya.',
  },
  {
    title: 'Baca denah',
    description: 'Sorot kategori, pilih booth, dan periksa ukuran, harga, serta statusnya.',
  },
  {
    title: 'Kunci booth',
    description:
      'Masuk untuk mengunci pilihan. Booth langsung ditandai agar tidak diambil orang lain.',
  },
]
