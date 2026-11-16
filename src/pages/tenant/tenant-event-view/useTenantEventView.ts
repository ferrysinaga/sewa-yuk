import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useToast } from '../../../components/ui/Toast'
import { getBookingErrorMessage } from '../../../lib/booking'
import { sweepExpiredBookings } from '../../../lib/bookingExpiry'
import { isCompleteBoothRow, mapRowToBooth } from '../../../lib/boothRow'
import type { BoothRow } from '../../../lib/boothRow'
import { createChannelName } from '../../../lib/id'
import { resolveRealtimeStatus } from '../../../lib/realtimeStatus'
import type { RealtimeStatus } from '../../../lib/realtimeStatus'
import { isSupabaseConfigured, supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/useAuthStore'
import { useBoothStore } from '../../../store/useBoothStore'
import type { BlueprintStatus } from '../../../types/blueprint'
import type { BookingRow, PaymentMethod } from '../../../types/booking'
import type { BoothCategory } from '../../../types/booth'

interface BlueprintRow {
  id: string
  name: string
  venue: string | null
  event_date: string | null
  description: string | null
  status: BlueprintStatus
  image_url: string | null
  image_path: string | null
}

function getLoadErrorMessage(error: { message?: string } | null): string {
  const message = error?.message ?? ''

  if (/could not find the table|relation .* does not exist|schema cache/i.test(message)) {
    return 'Tabel blueprints/booths belum tersedia di Supabase. Jalankan migrasi skema terlebih dahulu.'
  }

  return message || 'Gagal memuat data event.'
}

export function useTenantEventView() {
  const { eventId } = useParams<{ eventId: string }>()
  const session = useAuthStore((state) => state.session)
  const role = useAuthStore((state) => state.role)
  const setBooths = useBoothStore((state) => state.setBooths)
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [blueprint, setBlueprint] = useState<BlueprintRow | null>(null)
  const [activeCategory, setActiveCategory] = useState<BoothCategory | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [reserving, setReserving] = useState(false)
  const [reservedBoothId, setReservedBoothId] = useState<string | null>(null)
  const [reservedBooking, setReservedBooking] = useState<BookingRow | null>(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [syncStatus, setSyncStatus] = useState<RealtimeStatus>('connecting')
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)
  const locallyReservedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!eventId) {
      setError('ID event tidak valid.')
      setLoading(false)
      return
    }

    if (!isSupabaseConfigured) {
      setError('Supabase belum dikonfigurasi. Isi kredensial pada file .env terlebih dahulu.')
      setLoading(false)
      return
    }

    let cancelled = false

    setLoading(true)
    setError(null)
    setActiveCategory('all')
    setReservedBoothId(null)
    setReservedBooking(null)
    setCheckoutOpen(false)
    locallyReservedRef.current.clear()
    setBooths([])

    const loadEvent = async () => {
      // Lepas reservasi kedaluwarsa sebelum membaca booth agar booth yang
      // sudah bebas langsung tampil Available.
      await sweepExpiredBookings()

      if (cancelled) return

      const [blueprintResult, boothsResult] = await Promise.all([
        supabase.from('blueprints').select('*').eq('id', eventId).maybeSingle(),
        supabase.from('booths').select('*').eq('blueprint_id', eventId),
      ])

      if (cancelled) return

      if (blueprintResult.error) {
        setError(getLoadErrorMessage(blueprintResult.error))
        setLoading(false)
        return
      }

      if (!blueprintResult.data) {
        setError('Event tidak ditemukan atau belum dipublikasikan.')
        setLoading(false)
        return
      }

      if (boothsResult.error) {
        setError(getLoadErrorMessage(boothsResult.error))
        setLoading(false)
        return
      }

      const blueprintRow = blueprintResult.data as BlueprintRow

      setBlueprint(blueprintRow)
      setBooths(
        ((boothsResult.data ?? []) as BoothRow[]).map(mapRowToBooth),
        blueprintRow.image_url,
      )
      setLastSyncedAt(Date.now())
      setLoading(false)
    }

    void loadEvent()

    return () => {
      cancelled = true
    }
  }, [eventId, reloadToken, setBooths])

  useEffect(() => {
    if (!eventId || !isSupabaseConfigured) {
      setSyncStatus('disconnected')
      return
    }

    setSyncStatus('connecting')
    setLastSyncedAt(null)

    const channel = supabase
      .channel(createChannelName(`tenant-booths-${eventId}`))
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'booths',
          filter: `blueprint_id=eq.${eventId}`,
        },
        (payload) => {
          const boothState = useBoothStore.getState()

          if (payload.eventType === 'DELETE') {
            const deleted = payload.old as Partial<BoothRow>
            if (deleted?.id) boothState.removeRealtimeBooth(deleted.id)
            return
          }

          const row = payload.new as Partial<BoothRow>
          if (!row?.id) return

          const previous = boothState.booths.find((booth) => booth.id === row.id)

          if (isCompleteBoothRow(row)) {
            boothState.upsertRealtimeBooth(mapRowToBooth(row))
          } else if (row.status) {
            boothState.updateBoothStatus(row.id, row.status)
          }

          if (
            payload.eventType === 'UPDATE' &&
            row.status &&
            row.status !== 'Available' &&
            previous?.status === 'Available' &&
            !locallyReservedRef.current.has(row.id)
          ) {
            showToast(
              `Booth ${row.category ?? ''} baru saja dikunci oleh penyewa lain.`.replace(
                /\s+/g,
                ' ',
              ),
              'info',
            )
          }
        },
      )
      .subscribe((status) => {
        setSyncStatus(resolveRealtimeStatus(status))

        if (status === 'SUBSCRIBED') {
          setLastSyncedAt(Date.now())
        }

        if (status === 'CHANNEL_ERROR') {
          console.warn('Koneksi realtime booth gagal. Perubahan status mungkin tertunda.')
        }
      })

    return () => {
      setSyncStatus('disconnected')
      void supabase.removeChannel(channel)
    }
  }, [eventId, showToast])

  const handleOpenCheckout = () => {
    const store = useBoothStore.getState()
    const activeBooth = store.booths.find((booth) => booth.id === store.activeBoothId)

    if (!activeBooth || activeBooth.status !== 'Available') return

    if (!session) {
      showToast('Silakan masuk terlebih dahulu untuk mengunci booth.', 'info')
      navigate('/login', { state: { from: `/event/${eventId ?? ''}` } })
      return
    }

    if (!isSupabaseConfigured) {
      showToast('Supabase belum dikonfigurasi. Tidak dapat mengunci booth.', 'error')
      return
    }

    setCheckoutOpen(true)
  }

  const handleCloseCheckout = () => {
    if (reserving) return
    setCheckoutOpen(false)
  }

  const handleConfirmCheckout = async (paymentMethod: PaymentMethod) => {
    const store = useBoothStore.getState()
    const activeBooth = store.booths.find((booth) => booth.id === store.activeBoothId)

    if (!activeBooth || activeBooth.status !== 'Available') return

    if (!session) {
      showToast('Silakan masuk terlebih dahulu untuk mengunci booth.', 'info')
      setCheckoutOpen(false)
      navigate('/login', { state: { from: `/event/${eventId ?? ''}` } })
      return
    }

    if (!isSupabaseConfigured) {
      showToast('Supabase belum dikonfigurasi. Tidak dapat mengunci booth.', 'error')
      return
    }

    setReserving(true)
    locallyReservedRef.current.add(activeBooth.id)

    try {
      const { data, error: bookingError } = await supabase.rpc('create_booking', {
        p_booth_id: activeBooth.id,
        p_payment_method: paymentMethod,
      })

      if (bookingError) throw bookingError

      const booking = (Array.isArray(data) ? data[0] : data) as BookingRow | null

      if (!booking) {
        throw new Error('Pemesanan gagal dibuat. Silakan coba lagi.')
      }

      store.updateBoothStatus(activeBooth.id, 'Reserved')
      setReservedBoothId(activeBooth.id)
      setReservedBooking(booking)
      showToast(`Pesanan ${booking.booking_code} berhasil dibuat.`, 'success')
    } catch (reserveError) {
      locallyReservedRef.current.delete(activeBooth.id)
      showToast(`Gagal membuat pesanan: ${getBookingErrorMessage(reserveError)}`, 'error')
    } finally {
      setReserving(false)
    }
  }

  const activeBooth = useBoothStore((state) =>
    state.activeBoothId
      ? (state.booths.find((booth) => booth.id === state.activeBoothId) ?? null)
      : null,
  )
  const availableCount = useBoothStore(
    (state) => state.booths.filter((booth) => booth.status === 'Available').length,
  )
  const reservedCount = useBoothStore(
    (state) => state.booths.filter((booth) => booth.status === 'Reserved').length,
  )
  const totalBooths = useBoothStore((state) => state.booths.length)

  const retry = () => setReloadToken((token) => token + 1)

  return {
    blueprint,
    role,
    activeCategory,
    setActiveCategory,
    loading,
    error,
    retry,
    reserving,
    reservedBoothId,
    reservedBooking,
    checkoutOpen,
    syncStatus,
    lastSyncedAt,
    handleOpenCheckout,
    handleCloseCheckout,
    handleConfirmCheckout,
    activeBooth,
    availableCount,
    reservedCount,
    totalBooths,
    navigate,
  }
}

export type TenantEventViewState = ReturnType<typeof useTenantEventView>
