import { useEffect, useRef } from 'react'
import { isExpiredBooking } from '../lib/booking'
import type { BookingRow } from '../types/booking'

interface UseExpiredBookingSweepOptions {
  bookings: BookingRow[]
  now: number
  onSweep: () => Promise<number | null>
  onSwept?: (released: number | null) => void
}

/**
 * Memanggil sweep tepat sekali untuk setiap pasangan booking + expires_at
 * yang baru melewati batas pembayaran. Penanda disimpan di ref sehingga
 * tick clock berikutnya tidak memicu RPC yang sama berulang kali.
 */
export function useExpiredBookingSweep({
  bookings,
  now,
  onSweep,
  onSwept,
}: UseExpiredBookingSweepOptions): void {
  const handledRef = useRef(new Set<string>())
  const callbacksRef = useRef({ onSweep, onSwept })

  useEffect(() => {
    callbacksRef.current = { onSweep, onSwept }
  })

  useEffect(() => {
    const pendingKeys = bookings
      .filter((booking) => booking.status === 'pending' && isExpiredBooking(booking, now))
      .map((booking) => `${booking.id}:${booking.expires_at ?? ''}`)
      .filter((key) => !handledRef.current.has(key))

    if (pendingKeys.length === 0) return

    pendingKeys.forEach((key) => handledRef.current.add(key))

    let cancelled = false

    void callbacksRef.current
      .onSweep()
      .then((released) => {
        if (!cancelled) callbacksRef.current.onSwept?.(released)
      })
      .catch(() => {
        if (!cancelled) callbacksRef.current.onSwept?.(null)
      })

    return () => {
      cancelled = true
    }
  }, [bookings, now])
}
