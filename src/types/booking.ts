export type BookingStatus = 'pending' | 'awaiting_confirmation' | 'confirmed' | 'cancelled'
export type PaymentMethod = 'va' | 'transfer' | 'qris'

export interface BookingRow {
  id: string
  booking_code: string
  booth_id: string | null
  blueprint_id: string
  user_id: string
  tenant_name: string | null
  tenant_email: string | null
  tenant_phone: string | null
  booth_category: string
  price: number
  status: BookingStatus
  payment_method: PaymentMethod
  reserved_at: string
  expires_at: string | null
  paid_at: string | null
  cancelled_at: string | null
  cancelled_reason: string | null
  created_at: string
  updated_at: string
}

export const BOOKING_STATUS_OPTIONS: BookingStatus[] = [
  'pending',
  'awaiting_confirmation',
  'confirmed',
  'cancelled',
]

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  pending: 'Menunggu Pembayaran',
  awaiting_confirmation: 'Menunggu Verifikasi',
  confirmed: 'Terkonfirmasi',
  cancelled: 'Dibatalkan',
}

export const BOOKING_STATUS_BADGE: Record<BookingStatus, string> = {
  pending: 'bg-clay-soft text-clay-dark ring-line',
  awaiting_confirmation: 'bg-surface text-pine-dark ring-line',
  confirmed: 'bg-pine-soft text-pine-dark ring-line',
  cancelled: 'bg-unavailable text-muted ring-line',
}

export const BOOKING_STATUS_DOT: Record<BookingStatus, string> = {
  pending: 'bg-clay',
  awaiting_confirmation: 'bg-clay-dark',
  confirmed: 'bg-pine',
  cancelled: 'bg-muted',
}

// Label khusus untuk pembatalan otomatis akibat expires_at terlewat. Status
// tersimpan tetap 'cancelled', tetapi pengguna perlu melihat alasan yang jelas.
export const BOOKING_EXPIRED_LABEL = 'Kedaluwarsa'
export const BOOKING_EXPIRED_BADGE = 'bg-clay-soft text-clay-dark ring-line'
export const BOOKING_EXPIRED_DOT = 'bg-clay'

export const PAYMENT_METHOD_OPTIONS: PaymentMethod[] = ['va', 'transfer', 'qris']

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  va: 'Virtual Account',
  transfer: 'Transfer Bank',
  qris: 'QRIS',
}

export const PAYMENT_METHOD_DESCRIPTION: Record<PaymentMethod, string> = {
  va: 'BCA, BNI, Mandiri',
  transfer: 'Konfirmasi manual',
  qris: 'Semua e-wallet',
}

export function isBookingStatus(value: unknown): value is BookingStatus {
  return (
    value === 'pending' ||
    value === 'awaiting_confirmation' ||
    value === 'confirmed' ||
    value === 'cancelled'
  )
}

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return value === 'va' || value === 'transfer' || value === 'qris'
}

export function isBookingActionable(status: BookingStatus): boolean {
  return status === 'pending' || status === 'awaiting_confirmation'
}
