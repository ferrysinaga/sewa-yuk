import { useEffect, useState } from 'react'

/**
 * Waktu berjalan setiap detik selama `enabled` bernilai true. Halaman
 * mematikan clock ketika tidak ada booking pending agar tidak ada timer
 * yang terus berjalan tanpa manfaat.
 */
export function useBookingClock(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!enabled) return

    setNow(Date.now())
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000)

    return () => window.clearInterval(intervalId)
  }, [enabled])

  return now
}
