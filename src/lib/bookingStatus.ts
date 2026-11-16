import { isExpiredBooking } from './booking'
import {
  BOOKING_EXPIRED_BADGE,
  BOOKING_EXPIRED_DOT,
  BOOKING_EXPIRED_LABEL,
  BOOKING_STATUS_BADGE,
  BOOKING_STATUS_DOT,
  BOOKING_STATUS_LABEL,
} from '../types/booking'
import type { BookingRow, BookingStatus } from '../types/booking'

/**
 * Satu sumber presentasi status booking (UX-05). Semua komponen membaca label,
 * tone, aturan tenggat, dan copy dari modul ini agar tidak ada status yang
 * ditulis ulang di kartu, tabel, filter, atau toast.
 *
 * Modul ini hanya mengatur presentasi. Kontrak RPC dan query Supabase tidak
 * berubah: `pending` tetap status tersimpan untuk booking yang menunggu
 * pembayaran, dan `cancelled` + `cancelled_reason` tetap satu-satunya sumber
 * pembedaan manual vs kedaluwarsa.
 */

export type BookingStatusViewKey =
  | 'pending'
  | 'pending_expired'
  | 'awaiting_confirmation'
  | 'confirmed'
  | 'cancelled'
  | 'cancelled_expired'

export type BookingCountdownMode = 'remaining' | 'expired' | 'none'

export interface BookingStatusView {
  key: BookingStatusViewKey
  label: string
  badge: string
  dot: string
  /** Panel informasi di kartu tenant; `null` bila instruksi pembayaran yang tampil. */
  description: string | null
  panelClass: string
  showDeadline: boolean
  deadlineLabel: string
  deadlineTone: 'clay' | 'muted'
  countdown: BookingCountdownMode
  canCancel: boolean
  canMarkPaid: boolean
  canConfirm: boolean
}

export const AWAITING_DEADLINE_NOTE =
  'Batas ini tidak berlaku setelah konfirmasi pembayaran dikirim.'

const PANEL_EXPIRED =
  'rounded-card-sm border border-line bg-clay-soft p-3 text-xs leading-relaxed text-clay-dark'
const PANEL_AWAITING =
  'rounded-card-sm border border-line bg-canvas p-3 text-xs leading-relaxed text-ink'
const PANEL_CONFIRMED =
  'rounded-card-sm border border-line bg-pine-soft p-3 text-xs leading-relaxed text-pine-dark'
const PANEL_CANCELLED =
  'rounded-card-sm border border-line bg-unavailable p-3 text-xs leading-relaxed text-muted'

const EXPIRED_DESCRIPTION =
  'Pesanan kedaluwarsa karena batas pembayaran terlewat. Booth sudah dilepas dan dapat dipesan penyewa lain.'

function baseView(status: BookingStatus): Pick<BookingStatusView, 'badge' | 'dot'> {
  return { badge: BOOKING_STATUS_BADGE[status], dot: BOOKING_STATUS_DOT[status] }
}

export function getBookingStatusView(
  booking: Pick<BookingRow, 'status' | 'cancelled_reason' | 'expires_at'>,
  now: number = Date.now(),
): BookingStatusView {
  const expired = isExpiredBooking(booking, now)

  if (expired) {
    const cancelledExpired = booking.status === 'cancelled'

    return {
      key: cancelledExpired ? 'cancelled_expired' : 'pending_expired',
      label: BOOKING_EXPIRED_LABEL,
      badge: BOOKING_EXPIRED_BADGE,
      dot: BOOKING_EXPIRED_DOT,
      description: cancelledExpired
        ? EXPIRED_DESCRIPTION
        : 'Batas pembayaran sudah lewat. Pesanan akan dibatalkan otomatis dan booth dilepas untuk penyewa lain. Tekan tombol Perbarui status untuk memperbarui sekarang.',
      panelClass: PANEL_EXPIRED,
      showDeadline: !cancelledExpired,
      deadlineLabel: 'Batas pembayaran (terlewat)',
      deadlineTone: 'clay',
      countdown: cancelledExpired ? 'none' : 'expired',
      canCancel: !cancelledExpired,
      canMarkPaid: false,
      canConfirm: false,
    }
  }

  if (booking.status === 'pending') {
    return {
      key: 'pending',
      label: BOOKING_STATUS_LABEL.pending,
      ...baseView('pending'),
      description: null,
      panelClass: '',
      showDeadline: true,
      deadlineLabel: 'Batas pembayaran',
      deadlineTone: 'clay',
      countdown: 'remaining',
      canCancel: true,
      canMarkPaid: true,
      canConfirm: true,
    }
  }

  if (booking.status === 'awaiting_confirmation') {
    return {
      key: 'awaiting_confirmation',
      label: BOOKING_STATUS_LABEL.awaiting_confirmation,
      ...baseView('awaiting_confirmation'),
      description:
        'Konfirmasi pembayaran sudah dikirim. Organizer akan memverifikasi pembayaran Anda.',
      panelClass: PANEL_AWAITING,
      showDeadline: true,
      deadlineLabel: 'Batas pembayaran awal',
      deadlineTone: 'muted',
      countdown: 'none',
      canCancel: true,
      canMarkPaid: false,
      canConfirm: true,
    }
  }

  if (booking.status === 'confirmed') {
    return {
      key: 'confirmed',
      label: BOOKING_STATUS_LABEL.confirmed,
      ...baseView('confirmed'),
      description: 'Pembayaran terverifikasi. Booth sudah resmi menjadi milik Anda pada event ini.',
      panelClass: PANEL_CONFIRMED,
      showDeadline: false,
      deadlineLabel: '',
      deadlineTone: 'muted',
      countdown: 'none',
      canCancel: false,
      canMarkPaid: false,
      canConfirm: false,
    }
  }

  return {
    key: 'cancelled',
    label: BOOKING_STATUS_LABEL.cancelled,
    ...baseView('cancelled'),
    description: 'Pesanan dibatalkan. Booth sudah dilepas dan dapat dipesan penyewa lain.',
    panelClass: PANEL_CANCELLED,
    showDeadline: false,
    deadlineLabel: '',
    deadlineTone: 'muted',
    countdown: 'none',
    canCancel: false,
    canMarkPaid: false,
    canConfirm: false,
  }
}

/**
 * Kalimat lengkap untuk pembaca layar. Countdown visual berubah tiap detik,
 * jadi teks ini sengaja hanya berubah per menit dan dipasang sebagai aria-label
 * pada elemen `role="timer"` dengan `aria-live="off"`.
 */
export function describeRemainingTime(remainingMs: number | null): string {
  if (remainingMs === null) return 'Batas pembayaran tidak tersedia'

  if (remainingMs <= 0) return 'Batas pembayaran sudah lewat'

  const totalMinutes = Math.ceil(remainingMs / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const parts: string[] = []

  if (hours > 0) parts.push(`${hours} jam`)
  if (minutes > 0 || hours === 0) parts.push(`${minutes} menit`)

  return `Sisa waktu pembayaran ${parts.join(' ')}`
}

export const MARK_PAID_TOAST = 'Konfirmasi pembayaran dikirim. Menunggu verifikasi organizer.'

/**
 * Toast pembatalan mengikuti `cancelled_reason` dari RPC, sehingga booking yang
 * sudah lewat batas tidak lagi memakai copy pembatalan manual (PM-04 F-03).
 */
export function getCancelBookingToast(
  cancelledReason: string | null,
  options: { bookingCode?: string } = {},
): string {
  const { bookingCode } = options
  const expired = cancelledReason === 'expired'

  if (bookingCode) {
    return expired
      ? `Pesanan ${bookingCode} kedaluwarsa. Booth kembali tersedia.`
      : `Pesanan ${bookingCode} dibatalkan. Booth kembali tersedia.`
  }

  return expired
    ? 'Pesanan kedaluwarsa dan booth kembali tersedia.'
    : 'Pesanan dibatalkan dan booth kembali tersedia.'
}

export function getConfirmBookingToast(bookingCode: string): string {
  return `Pembayaran ${bookingCode} dikonfirmasi. Booth menjadi terisi.`
}

export function getExpiredSweepToast(count: number): string {
  return `${count} pesanan kedaluwarsa dibatalkan dan booth kembali tersedia.`
}
