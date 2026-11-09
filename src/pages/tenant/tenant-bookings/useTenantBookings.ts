import { useEffect, useMemo, useState } from 'react'
import { useToast } from '../../../components/ui/Toast'
import { useBookingClock } from '../../../hooks/useBookingClock'
import { useBookingFeed } from '../../../hooks/useBookingFeed'
import { useExpiredBookingSweep } from '../../../hooks/useExpiredBookingSweep'
import { getBookingErrorMessage, isExpiredBooking } from '../../../lib/booking'
import { sweepExpiredBookings } from '../../../lib/bookingExpiry'
import { isSupabaseConfigured, supabase } from '../../../lib/supabase'
import { useAuthStore } from '../../../store/useAuthStore'
import { BOOKING_STATUS_OPTIONS } from '../../../types/booking'
import type { BookingRow, BookingStatus } from '../../../types/booking'

interface BlueprintSummaryRow {
  id: string
  name: string
  venue: string | null
  event_date: string | null
}

export const statusFilters: (BookingStatus | 'all')[] = ['all', ...BOOKING_STATUS_OPTIONS]

export function useTenantBookings() {
  const user = useAuthStore((state) => state.user)
  const { showToast } = useToast()

  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [blueprints, setBlueprints] = useState<BlueprintSummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null)
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [confirmingCancelId, setConfirmingCancelId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const hasPendingBooking = bookings.some((booking) => booking.status === 'pending')
  const now = useBookingClock(hasPendingBooking)

  const feed = useBookingFeed({ userId: user?.id ?? null, setBookings, enabled: Boolean(user) })
  const lastUpdatedAt = Math.max(feed.lastEventAt ?? 0, lastLoadedAt ?? 0) || null

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setError('Supabase belum dikonfigurasi. Isi kredensial pada file .env terlebih dahulu.')
      setLoading(false)
      return
    }

    if (!user) {
      setBookings([])
      setLoading(false)
      return
    }

    let cancelled = false

    setLoading(true)
    setError(null)

    const loadBookings = async () => {
      // Lepas booking kedaluwarsa lebih dulu agar status booth yang tampil
      // sudah mencerminkan data terbaru saat pg_cron tidak aktif.
      await sweepExpiredBookings()

      if (cancelled) return

      const [bookingResult, blueprintResult] = await Promise.all([
        supabase.from('bookings').select('*').order('created_at', { ascending: false }),
        supabase.from('blueprints').select('id, name, venue, event_date'),
      ])

      if (cancelled) return

      if (bookingResult.error) {
        setError(getBookingErrorMessage(bookingResult.error))
        setLoading(false)
        return
      }

      if (blueprintResult.error) {
        setError(getBookingErrorMessage(blueprintResult.error))
        setLoading(false)
        return
      }

      setBookings((bookingResult.data ?? []) as BookingRow[])
      setBlueprints((blueprintResult.data ?? []) as BlueprintSummaryRow[])
      setLastLoadedAt(Date.now())
      setLoading(false)
    }

    void loadBookings()

    return () => {
      cancelled = true
    }
  }, [reloadToken, user])

  useExpiredBookingSweep({
    bookings,
    now,
    onSweep: sweepExpiredBookings,
    onSwept: (released) => {
      if (released) {
        showToast(
          `${released} pesanan kedaluwarsa dibatalkan dan booth kembali tersedia.`,
          'info',
        )
      }

      setReloadToken((token) => token + 1)
    },
  })

  const blueprintById = useMemo(
    () => new Map(blueprints.map((blueprint) => [blueprint.id, blueprint])),
    [blueprints],
  )

  const visibleBookings = useMemo(
    () =>
      statusFilter === 'all'
        ? bookings
        : bookings.filter((booking) => booking.status === statusFilter),
    [bookings, statusFilter],
  )

  const metrics = useMemo(() => {
    const active = bookings.filter(
      (booking) =>
        booking.status === 'awaiting_confirmation' ||
        (booking.status === 'pending' && !isExpiredBooking(booking, now)),
    ).length
    const confirmed = bookings.filter((booking) => booking.status === 'confirmed')
    const totalPaid = confirmed.reduce((sum, booking) => sum + booking.price, 0)

    return { active, confirmed: confirmed.length, totalPaid }
  }, [bookings, now])

  const handleMarkPaid = async (booking: BookingRow) => {
    if (updatingId) return

    setUpdatingId(booking.id)

    try {
      const { data, error: rpcError } = await supabase.rpc('mark_booking_paid', {
        p_booking_id: booking.id,
      })

      if (rpcError) throw rpcError

      const updated = (Array.isArray(data) ? data[0] : data) as BookingRow | null

      if (updated) {
        setBookings((current) =>
          current.map((row) => (row.id === updated.id ? updated : row)),
        )
      }

      showToast('Konfirmasi pembayaran dikirim. Menunggu verifikasi organizer.', 'success')
    } catch (paymentError) {
      showToast(`Gagal mengirim konfirmasi: ${getBookingErrorMessage(paymentError)}`, 'error')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleCancel = async (booking: BookingRow) => {
    if (updatingId) return

    setConfirmingCancelId(null)
    setUpdatingId(booking.id)

    try {
      const { data, error: rpcError } = await supabase.rpc('cancel_booking', {
        p_booking_id: booking.id,
      })

      if (rpcError) throw rpcError

      const updated = (Array.isArray(data) ? data[0] : data) as BookingRow | null

      if (updated) {
        setBookings((current) =>
          current.map((row) => (row.id === updated.id ? updated : row)),
        )
      }

      showToast('Pesanan dibatalkan dan booth kembali tersedia.', 'success')
    } catch (cancelError) {
      showToast(`Gagal membatalkan pesanan: ${getBookingErrorMessage(cancelError)}`, 'error')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleRefresh = async () => {
    if (refreshing) return

    setRefreshing(true)

    try {
      const released = await sweepExpiredBookings()

      if (released) {
        showToast(
          `${released} pesanan kedaluwarsa dibatalkan dan booth kembali tersedia.`,
          'info',
        )
      }
    } finally {
      setRefreshing(false)
      setReloadToken((token) => token + 1)
    }
  }

  const retry = () => setReloadToken((token) => token + 1)

  return {
    bookings,
    blueprints,
    loading,
    error,
    retry,
    statusFilter,
    setStatusFilter,
    updatingId,
    confirmingCancelId,
    setConfirmingCancelId,
    refreshing,
    now,
    feed,
    lastUpdatedAt,
    blueprintById,
    visibleBookings,
    metrics,
    handleMarkPaid,
    handleCancel,
    handleRefresh,
  }
}

export type TenantBookingsState = ReturnType<typeof useTenantBookings>
