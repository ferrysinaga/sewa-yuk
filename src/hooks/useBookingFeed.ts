import { useEffect, useState } from 'react'
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
}: UseBookingFeedOptions): BookingFeedState {
  const [status, setStatus] = useState<RealtimeStatus>('connecting')
  const [lastEventAt, setLastEventAt] = useState<number | null>(null)

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
          setBookings((current) =>
            applyBookingChange(current, payload as BookingRealtimePayload),
          )
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
