import type { BookingRow } from '../types/booking'

export type BookingRealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE'

export interface BookingRealtimePayload {
  eventType?: BookingRealtimeEvent
  new?: Partial<BookingRow>
  old?: Partial<BookingRow>
}

/**
 * Terapkan payload Realtime tabel bookings ke daftar lokal.
 *
 * Payload penuh dari Supabase tetap menghasilkan baris yang sama. Untuk
 * payload parsial, UPDATE menggabungkan field yang ada agar data lama tidak
 * hilang, sedangkan baris baru tetap ditambahkan di depan seperti sebelumnya.
 */
export function applyBookingChange(
  current: BookingRow[],
  payload: BookingRealtimePayload,
): BookingRow[] {
  if (payload.eventType === 'DELETE') {
    const deletedId = payload.old?.id
    return deletedId ? current.filter((booking) => booking.id !== deletedId) : current
  }

  const row = payload.new
  if (!row?.id) return current

  const exists = current.some((booking) => booking.id === row.id)

  if (!exists) return [row as BookingRow, ...current]

  return current.map((booking) => (booking.id === row.id ? { ...booking, ...row } : booking))
}
