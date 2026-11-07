import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { applyBookingChange } from '../lib/bookingRealtime'
import type { BookingRealtimePayload } from '../lib/bookingRealtime'
import { createChannelName } from '../lib/id'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { BookingRow } from '../types/booking'

interface UseBookingFeedOptions {
  /** null untuk feed organizer (semua booking); string untuk feed tenant. */
  userId: string | null
  setBookings: Dispatch<SetStateAction<BookingRow[]>>
  enabled?: boolean
}

/**
 * Berlangganan perubahan tabel bookings dan menerapkannya lewat reducer
 * bersama. Nama channel dipertahankan agar perilaku realtime tidak berubah.
 */
export function useBookingFeed({
  userId,
  setBookings,
  enabled = true,
}: UseBookingFeedOptions): boolean {
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured) {
      setIsLive(false)
      return
    }

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
        },
      )
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED')

        if (status === 'CHANNEL_ERROR') {
          console.warn('Koneksi realtime pemesanan gagal. Perubahan status mungkin tertunda.')
        }
      })

    return () => {
      setIsLive(false)
      void supabase.removeChannel(channel)
    }
  }, [enabled, setBookings, userId])

  return isLive
}
