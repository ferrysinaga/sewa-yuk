import type { BookingRow, PaymentMethod } from '../types/booking'
import { PAYMENT_METHOD_LABEL } from '../types/booking'
import { formatCurrency } from './currency'

export { formatCurrency }

export function formatDateTime(value: string | null): string {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function formatDate(value: string | null): string {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(date)
}

/**
 * Sisa waktu pembayaran dalam milidetik. Nilai negatif berarti batas sudah
 * terlewat, sedangkan null berarti booking tidak memiliki batas yang valid.
 */
export function getRemainingMs(expiresAt: string | null, now: number = Date.now()): number | null {
  if (!expiresAt) return null

  const expiresAtMs = new Date(expiresAt).getTime()

  if (Number.isNaN(expiresAtMs)) return null

  return expiresAtMs - now
}

/** Format hitungan waktu menjadi "HH:MM:SS" atau "Kedaluwarsa". */
export function formatRemaining(remainingMs: number | null): string {
  if (remainingMs === null) return '—'
  if (remainingMs <= 0) return 'Kedaluwarsa'

  const totalSeconds = Math.ceil(remainingMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':')
}

/**
 * True bila batas pembayaran booking sudah lewat. Dipakai untuk menonaktifkan
 * aksi "Saya sudah bayar" sebelum sweep server sempat membatalkan booking.
 */
export function isBookingExpired(
  booking: Pick<BookingRow, 'expires_at'>,
  now: number = Date.now(),
): boolean {
  const remaining = getRemainingMs(booking.expires_at, now)

  return remaining !== null && remaining <= 0
}

/**
 * Booking dianggap kedaluwarsa bila sudah dibatalkan karena expired, atau
 * masih pending tetapi batas pembayarannya sudah lewat (menunggu sweep).
 * Booking awaiting_confirmation tidak ikut kedaluwarsa karena penyewa sudah
 * menandai pembayaran dan menunggu verifikasi organizer.
 */
export function isExpiredBooking(
  booking: Pick<BookingRow, 'status' | 'cancelled_reason' | 'expires_at'>,
  now: number = Date.now(),
): boolean {
  if (booking.status === 'cancelled') {
    return booking.cancelled_reason === 'expired'
  }

  return booking.status === 'pending' && isBookingExpired(booking, now)
}

export function getBookingErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '')

  if (/could not find the table|relation .* does not exist|schema cache/i.test(message)) {
    return 'Tabel pemesanan belum tersedia. Jalankan migrasi pemesanan terlebih dahulu.'
  }

  if (/could not find the function|function .* does not exist/i.test(message)) {
    return 'Fungsi pemesanan belum tersedia. Jalankan migrasi pemesanan terlebih dahulu.'
  }

  if (/violates row-level security|permission denied/i.test(message)) {
    return 'Anda tidak memiliki akses untuk tindakan ini.'
  }

  return message || 'Terjadi kesalahan saat memproses pemesanan.'
}

interface PaymentInstruction {
  title: string
  lines: string[]
  note: string
}

/**
 * Instruksi pembayaran masih bersifat simulasi karena aplikasi belum terhubung
 * ke payment gateway. Nomor Virtual Account diturunkan dari kode pemesanan agar
 * tampil konsisten tanpa menyimpan data sensitif.
 */
export function getPaymentInstruction(
  method: PaymentMethod,
  booking: Pick<BookingRow, 'booking_code' | 'price'>,
): PaymentInstruction {
  const digits = booking.booking_code.replace(/\D/g, '').padEnd(8, '0')
  const virtualAccount = `8808 ${digits.slice(0, 4)} ${digits.slice(4, 8)}`
  const amount = formatCurrency(booking.price)

  if (method === 'va') {
    return {
      title: PAYMENT_METHOD_LABEL.va,
      lines: [`Nomor VA: ${virtualAccount}`, `Nominal: ${amount}`],
      note: 'Nomor Virtual Account di atas adalah simulasi. Pada implementasi produksi, nomor dibuat oleh payment gateway.',
    }
  }

  if (method === 'transfer') {
    return {
      title: PAYMENT_METHOD_LABEL.transfer,
      lines: ['BCA 5271 0000 1234', 'a.n. Sewa-Yuk Indonesia', `Nominal: ${amount}`],
      note: 'Rekening tujuan di atas adalah simulasi. Setelah mentransfer, tekan "Saya sudah bayar" agar organizer memverifikasi.',
    }
  }

  return {
    title: PAYMENT_METHOD_LABEL.qris,
    lines: ['Pindai kode QRIS pada halaman pembayaran.', `Nominal: ${amount}`],
    note: 'QRIS masih berupa simulasi. Setelah membayar, tekan "Saya sudah bayar" agar organizer memverifikasi.',
  }
}
