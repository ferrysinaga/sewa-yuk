/**
 * Satu sumber format mata uang agar harga booth dan nominal booking selalu
 * tampil identik. Format mengikuti locale Indonesia tanpa desimal.
 */
export function formatPrice(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)
}

// Nama lama dipertahankan agar pemanggil lib/booking tidak perlu berubah.
export const formatCurrency = formatPrice
