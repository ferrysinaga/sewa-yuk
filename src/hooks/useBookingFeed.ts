import { useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { applyBookingChange } from '../lib/bookingRealtime'
import type { BookingRealtimePayload } from '../lib/bookingRealtime'
import { createChannelName } from '../lib/id'
import { resolveRealtimeStatus } from '../lib/realtimeStatus'
import type { RealtimeStatus } from '../lib/realtimeStatus'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { BookingRow } from '../types/booking'
import { useOnlineStatus } from './useOnlineStatus'

interface UseBookingFeedOptions {
  /** null untuk feed organizer (semua booking); string untuk feed tenant. */
  userId: string | null
  setBookings: Dispatch<SetStateAction<BookingRow[]>>
  enabled?: boolean
  /** Ganti reducer bawaan, misalnya untuk halaman yang hanya memuat 25 baris. */
  transform?: (current: BookingRow[], payload: BookingRealtimePayload) => BookingRow[]
  /** Dipanggil untuk setiap payload, misalnya untuk memperbarui total count. */
  onPayload?: (payload: BookingRealtimePayload) => void
  /**
   * Dipanggil setelah channel tersambung kembali (reconnect) atau browser
   * kembali online. Halaman memakai ini untuk refetch data yang terlewat.
   * Tidak dipanggil pada koneksi pertama karena pemuatan awal sudah dilakukan
   * oleh halaman.
   */
  onResync?: () => void
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
  onResync,
}: UseBookingFeedOptions): BookingFeedState {
  const [status, setStatus] = useState<RealtimeStatus>('connecting')
  const [lastEventAt, setLastEventAt] = useState<number | null>(null)
  const isOnline = useOnlineStatus()

  // Simpan callback terbaru di ref agar perubahan filter atau halaman tidak
  // memutus dan membuat ulang channel realtime.
  const transformRef = useRef(transform)
  transformRef.current = transform
  const onPayloadRef = useRef(onPayload)
  onPayloadRef.current = onPayload
  const onResyncRef = useRef(onResync)
  onResyncRef.current = onResync
  const hasSubscribedRef = useRef(false)
  const wasOnlineRef = useRef(isOnline)

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured) {
      setStatus('disconnected')
      return
    }

    setStatus('connecting')
    setLastEventAt(null)
    hasSubscribedRef.current = false

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

          // Reconnect: event selama offline mungkin hilang, jadi minta halaman
          // melakukan refetch sekali. Koneksi pertama tidak memicu refetch.
          if (hasSubscribedRef.current) {
            onResyncRef.current?.()
          }
          hasSubscribedRef.current = true
        }

        if (channelStatus === 'CHANNEL_ERROR') {
          console.warn('Koneksi realtime pemesanan gagal. Perubahan status mungkin tertunda.')
        }
      })

    return () => {
      setStatus('disconnected')
      hasSubscribedRef.current = false
      void supabase.removeChannel(channel)
    }
  }, [enabled, setBookings, userId])

  useEffect(() => {
    if (isOnline && !wasOnlineRef.current && hasSubscribedRef.current) {
      onResyncRef.current?.()
    }

    wasOnlineRef.current = isOnline
  }, [isOnline])

  return { status: isOnline ? status : 'disconnected', lastEventAt }
}
