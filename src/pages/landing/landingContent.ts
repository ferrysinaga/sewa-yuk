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
  { id: 'A-01', label: 'Booth A-01', category: 'Tech', price: 4500000, size: '3 × 3 m', note: 'Sayap kiri · dekat aisle utama', x: 24, y: 64, width: 120, height: 76, status: 'Available' },
  { id: 'A-02', label: 'Booth A-02', category: 'F&B', price: 3800000, size: '3 × 3 m', note: 'Sayap kiri · dekat area makanan', x: 24, y: 152, width: 120, height: 76, status: 'Available' },
  { id: 'A-03', label: 'Booth A-03', category: 'Apparel', price: 3200000, size: '3 × 3 m', note: 'Sayap kiri · dekat area fashion', x: 24, y: 240, width: 120, height: 76, status: 'Booked' },
  { id: 'A-04', label: 'Booth A-04', category: 'Tech', price: 2900000, size: '2 × 3 m', note: 'Sayap kiri · dekat pintu masuk', x: 24, y: 320, width: 120, height: 64, status: 'Available' },
  { id: 'B-01', label: 'Booth B-01', category: 'F&B', price: 6200000, size: '4 × 3 m', note: 'Area tengah · posisi premium', x: 300, y: 64, width: 196, height: 88, status: 'Available' },
  { id: 'B-02', label: 'Booth B-02', category: 'Tech', price: 7400000, size: '4 × 3 m', note: 'Area tengah · paling strategis', x: 300, y: 164, width: 196, height: 88, status: 'Available' },
  { id: 'B-03', label: 'Booth B-03', category: 'Apparel', price: 5100000, size: '4 × 3 m', note: 'Area tengah · dekat pintu masuk', x: 300, y: 264, width: 196, height: 88, status: 'Reserved' },
]

export const categoryFilters: Array<{ value: Category | 'all'; label: string }> = [
  { value: 'all', label: 'Semua' },
  { value: 'Tech', label: 'Teknologi' },
  { value: 'F&B', label: 'F&B' },
  { value: 'Apparel', label: 'Pakaian' },
]

export const navItems = [
  { label: 'Penyelenggara', href: '#penyelenggara' },
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
