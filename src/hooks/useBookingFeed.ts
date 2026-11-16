import { useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { applyBookingChange } from '../lib/bookingRealtime'
import type { BookingRealtimePayload } from '../lib/bookingRealtime'
import { createChannelName } from '../lib/id'
import { resolveRealtimeStatus } from '../lib/realtimeStatus'
import type { RealtimeStatus } from '../lib/realtimeStatus'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { BookingRow } from '../types/booking'

interface UseBookingFeedOptions {
  /** null untuk feed organizer (semua booking); string untuk feed tenant. */
  userId: string | null
  setBookings: Dispatch<SetStateAction<BookingRow[]>>
  enabled?: boolean
  /** Ganti reducer bawaan, misalnya untuk halaman yang hanya memuat 25 baris. */
  transform?: (current: BookingRow[], payload: BookingRealtimePayload) => BookingRow[]
  /** Dipanggil untuk setiap payload, misalnya untuk memperbarui total count. */
  onPayload?: (payload: BookingRealtimePayload) => void
}

interface BookingFeedState {
  status: RealtimeStatus
  lastEventAt: number | null
}

/**
 * Berlangganan perubahan tabel bookings dan menerapkannya lewat reducer
 * bersama. Nama channel dipertahankan agar perilaku realtime tidak berubah,
 * sekaligus mengembalikan status koneksi untuk indikator UI.
 */
export function useBookingFeed({
  userId,
  setBookings,
  enabled = true,
  transform,
  onPayload,
}: UseBookingFeedOptions): BookingFeedState {
  const [status, setStatus] = useState<RealtimeStatus>('connecting')
  const [lastEventAt, setLastEventAt] = useState<number | null>(null)

  // Simpan callback terbaru di ref agar perubahan filter atau halaman tidak
  // memutus dan membuat ulang channel realtime.
  const transformRef = useRef(transform)
  transformRef.current = transform
  const onPayloadRef = useRef(onPayload)
  onPayloadRef.current = onPayload

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured) {
      setStatus('disconnected')
      return
    }

    setStatus('connecting')
    setLastEventAt(null)

    const isTenantFeed = userId !== null
    const channel = supabase
      .channel(createChannelName(isTenantFeed ? `tenant-bookings-${userId}` : 'admin-bookings'))
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          ...(isTenantFeed ? { filter: `user_id=eq.${userId}` } : {}),
        },
        (payload) => {
          const change = payload as BookingRealtimePayload
          const transformCurrent = transformRef.current

          setBookings((current) =>
            transformCurrent
              ? transformCurrent(current, change)
              : applyBookingChange(current, change),
          )
          onPayloadRef.current?.(change)
          setLastEventAt(Date.now())
        },
      )
      .subscribe((channelStatus) => {
        setStatus(resolveRealtimeStatus(channelStatus))

        if (channelStatus === 'SUBSCRIBED') {
          setLastEventAt(Date.now())
        }

        if (channelStatus === 'CHANNEL_ERROR') {
          console.warn('Koneksi realtime pemesanan gagal. Perubahan status mungkin tertunda.')
        }
      })

    return () => {
      setStatus('disconnected')
      void supabase.removeChannel(channel)
    }
  }, [enabled, setBookings, userId])

  return { status, lastEventAt }
}
