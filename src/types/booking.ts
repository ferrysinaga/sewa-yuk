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
  pending: 'bg-amber-50 text-amber-700 ring-amber-100',
  awaiting_confirmation: 'bg-blue-50 text-blue-700 ring-blue-100',
  confirmed: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  cancelled: 'bg-gray-100 text-gray-600 ring-gray-200',
}

export const BOOKING_STATUS_DOT: Record<BookingStatus, string> = {
  pending: 'bg-amber-500',
  awaiting_confirmation: 'bg-blue-500',
  confirmed: 'bg-emerald-500',
  cancelled: 'bg-gray-400',
}

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
