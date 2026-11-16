import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToast } from '../../../components/ui/Toast'
import { useBookingClock } from '../../../hooks/useBookingClock'
import { useBookingFeed } from '../../../hooks/useBookingFeed'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { getBookingErrorMessage, isExpiredBooking } from '../../../lib/booking'
import type { BookingRealtimePayload } from '../../../lib/bookingRealtime'
import { sweepExpiredBookings } from '../../../lib/bookingExpiry'
import { isSupabaseConfigured, supabase } from '../../../lib/supabase'
import type { BookingRow, BookingStatus } from '../../../types/booking'
import type { BlueprintStatus } from '../../../types/blueprint'

const PAGE_SIZE = 25
const EMPTY_BLUEPRINT_IDS: string[] = []

interface BlueprintSummaryRow {
  id: string
  name: string
  venue: string | null
  event_date: string | null
  status: BlueprintStatus
}

interface BookingMetricRow {
  id: string
  status: BookingStatus
  price: number
  expires_at: string | null
  cancelled_reason: string | null
}

export function useAdminBookings() {
  const { showToast } = useToast()

  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [blueprints, setBlueprints] = useState<BlueprintSummaryRow[]>([])
  const [metricRows, setMetricRows] = useState<BookingMetricRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [metaLoading, setMetaLoading] = useState(true)
  const [listLoading, setListLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [listReloadToken, setListReloadToken] = useState(0)
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null)

  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all')
  const [eventFilter, setEventFilter] = useState('all')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 250)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [confirmingCancelId, setConfirmingCancelId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const filtersActive = search.trim().length > 0 || eventFilter !== 'all' || statusFilter !== 'all'

  const searchTerm = debouncedSearch
    .trim()
    .replace(/[,()%]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const loading = (metaLoading || listLoading) && lastLoadedAt === null

  const blueprintById = useMemo(
    () => new Map(blueprints.map((blueprint) => [blueprint.id, blueprint])),
    [blueprints],
  )

  const matchingBlueprintIds = useMemo(() => {
    if (!searchTerm) return EMPTY_BLUEPRINT_IDS

    const term = searchTerm.toLowerCase()
    const ids = blueprints
      .filter((blueprint) => blueprint.name.toLowerCase().includes(term))
      .map((blueprint) => blueprint.id)

    return ids.length > 0 ? ids : EMPTY_BLUEPRINT_IDS
  }, [blueprints, searchTerm])

  const matchesBookingFilters = useCallback(
    (booking: BookingRow) => {
      if (statusFilter !== 'all' && booking.status !== statusFilter) return false
      if (eventFilter !== 'all' && booking.blueprint_id !== eventFilter) return false
      if (!searchTerm) return true

      const eventName = blueprintById.get(booking.blueprint_id)?.name ?? ''
      const haystack =
        `${booking.booking_code} ${booking.tenant_name ?? ''} ${booking.tenant_email ?? ''} ${booking.booth_category} ${eventName}`.toLowerCase()

      return haystack.includes(searchTerm.toLowerCase())
    },
    [blueprintById, eventFilter, searchTerm, statusFilter],
  )

  const handleResetFilters = () => {
    setSearch('')
    setEventFilter('all')
    setStatusFilter('all')
    setPage(1)
  }

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const handleEventFilterChange = (value: string) => {
    setEventFilter(value)
    setPage(1)
  }

  const handleStatusFilterChange = (value: BookingStatus | 'all') => {
    setStatusFilter(value)
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const pageStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const pageEnd = Math.min(page * PAGE_SIZE, totalCount)

  const upsertMetricRow = useCallback((row: BookingRow) => {
    const metric: BookingMetricRow = {
      id: row.id,
      status: row.status,
      price: row.price,
      expires_at: row.expires_at,
      cancelled_reason: row.cancelled_reason,
    }

    setMetricRows((current) => {
      const index = current.findIndex((item) => item.id === row.id)
      if (index === -1) return [...current, metric]

      const next = current.slice()
      next[index] = metric
      return next
    })
  }, [])

  const patchMetricRow = useCallback((row: Partial<BookingRow> & { id: string }) => {
    setMetricRows((current) => {
      const index = current.findIndex((item) => item.id === row.id)
      if (index === -1) return current

      const next = current.slice()
      next[index] = {
        ...next[index],
        ...(row.status !== undefined ? { status: row.status } : {}),
        ...(row.price !== undefined ? { price: row.price } : {}),
        ...('expires_at' in row ? { expires_at: row.expires_at ?? null } : {}),
        ...('cancelled_reason' in row ? { cancelled_reason: row.cancelled_reason ?? null } : {}),
      }
      return next
    })
  }, [])

  const handleFeedTransform = useCallback(
    (current: BookingRow[], payload: BookingRealtimePayload): BookingRow[] => {
      if (payload.eventType === 'DELETE') {
        const deletedId = payload.old?.id
        return deletedId ? current.filter((booking) => booking.id !== deletedId) : current
      }

      const incoming = payload.new
      if (!incoming?.id) return current

      const index = current.findIndex((booking) => booking.id === incoming.id)

      if (payload.eventType === 'INSERT') {
        if (page !== 1 || index !== -1) return current

        const fullRow = incoming as BookingRow
        if (!matchesBookingFilters(fullRow)) return current

        return [fullRow, ...current].slice(0, PAGE_SIZE)
      }

      if (index === -1) return current

      const merged = { ...current[index], ...incoming }

      if (!matchesBookingFilters(merged)) {
        return current.filter((booking) => booking.id !== incoming.id)
      }

      return current.map((booking) => (booking.id === incoming.id ? merged : booking))
    },
    [matchesBookingFilters, page],
  )

  const handleFeedPayload = useCallback(
    (payload: BookingRealtimePayload) => {
      const eventType = payload.eventType

      if (eventType === 'INSERT' && payload.new?.id) {
        const row = payload.new as BookingRow

        if (matchesBookingFilters(row)) {
          setTotalCount((count) => count + 1)
        }
        upsertMetricRow(row)
        return
      }

      if (eventType === 'DELETE' && payload.old?.id) {
        const deletedId = payload.old.id
        setMetricRows((current) => current.filter((item) => item.id !== deletedId))

        // Payload DELETE dari Supabase umumnya hanya memuat id, sehingga
        // jumlah hasil filter harus dihitung ulang di server.
        if (filtersActive) {
          setListReloadToken((token) => token + 1)
        } else {
          setTotalCount((count) => Math.max(0, count - 1))
        }
        return
      }

      if (eventType === 'UPDATE' && payload.new?.id) {
        patchMetricRow(payload.new as Partial<BookingRow> & { id: string })

        // Perubahan status dapat memindahkan baris masuk atau keluar dari
        // hasil filter, jadi minta daftar disegarkan dari server.
        if (statusFilter !== 'all' && payload.new.status) {
          setListReloadToken((token) => token + 1)
        }
      }
    },
    [filtersActive, matchesBookingFilters, patchMetricRow, statusFilter, upsertMetricRow],
  )

  useEffect(() => {
    let cancelled = false

    if (!isSupabaseConfigured) {
      setError('Supabase belum dikonfigurasi. Isi kredensial pada file .env terlebih dahulu.')
      setMetaLoading(false)
      setListLoading(false)
      return
    }

    setMetaLoading(true)
    setError(null)

    const loadMeta = async () => {
      // Lepas booking kedaluwarsa lebih dulu agar daftar dan status booth
      // konsisten meskipun pg_cron belum aktif.
      await sweepExpiredBookings()

      if (cancelled) return

      const [blueprintResult, metricResult] = await Promise.all([
        supabase.from('blueprints').select('id, name, venue, event_date, status'),
        supabase.from('bookings').select('id, status, price, expires_at, cancelled_reason'),
      ])

      if (cancelled) return

      if (blueprintResult.error) {
        setError(getBookingErrorMessage(blueprintResult.error))
        setMetaLoading(false)
        return
      }

      if (metricResult.error) {
        setError(getBookingErrorMessage(metricResult.error))
        setMetaLoading(false)
        return
      }

      setBlueprints((blueprintResult.data ?? []) as BlueprintSummaryRow[])
      setMetricRows((metricResult.data ?? []) as BookingMetricRow[])
      setMetaLoading(false)
    }

    void loadMeta()

    return () => {
      cancelled = true
    }
  }, [reloadToken])

  useEffect(() => {
    let cancelled = false

    if (!isSupabaseConfigured) {
      setListLoading(false)
      return
    }

    setListLoading(true)

    const loadPage = async () => {
      const offset = (page - 1) * PAGE_SIZE

      let query = supabase
        .from('bookings')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      if (eventFilter !== 'all') {
        query = query.eq('blueprint_id', eventFilter)
      }

      if (searchTerm) {
        const orParts = [
          `booking_code.ilike.%${searchTerm}%`,
          `tenant_name.ilike.%${searchTerm}%`,
          `tenant_email.ilike.%${searchTerm}%`,
          `booth_category.ilike.%${searchTerm}%`,
        ]

        if (matchingBlueprintIds.length > 0) {
          orParts.push(`blueprint_id.in.(${matchingBlueprintIds.join(',')})`)
        }

        query = query.or(orParts.join(','))
      }

      const { data, error: listError, count } = await query

      if (cancelled) return

      if (listError) {
        setError(getBookingErrorMessage(listError))
        setListLoading(false)
        return
      }

      setBookings((data ?? []) as BookingRow[])
      setTotalCount(count ?? 0)
      setLastLoadedAt(Date.now())
      setListLoading(false)
    }

    void loadPage()

    return () => {
      cancelled = true
    }
  }, [
    eventFilter,
    listReloadToken,
    matchingBlueprintIds,
    page,
    reloadToken,
    searchTerm,
    statusFilter,
  ])

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages))
  }, [totalPages])

  const hasPendingBooking = metricRows.some((row) => row.status === 'pending')
  const now = useBookingClock(hasPendingBooking)

  const feed = useBookingFeed({
    userId: null,
    setBookings,
    transform: handleFeedTransform,
    onPayload: handleFeedPayload,
  })
  const lastUpdatedAt = Math.max(feed.lastEventAt ?? 0, lastLoadedAt ?? 0) || null

  const metrics = useMemo(() => {
    const awaiting = metricRows.filter((row) => row.status === 'awaiting_confirmation').length
    const pending = metricRows.filter(
      (row) => row.status === 'pending' && !isExpiredBooking(row, now),
    ).length
    const confirmed = metricRows.filter((row) => row.status === 'confirmed')
    const revenue = confirmed.reduce((sum, row) => sum + row.price, 0)

    return { awaiting, pending, confirmed: confirmed.length, revenue }
  }, [metricRows, now])

  const goToPage = (next: number) => {
    setPage(Math.min(Math.max(1, next), totalPages))
  }

  const applyUpdatedBooking = (updated: BookingRow) => {
    const stillMatches = matchesBookingFilters(updated)

    setBookings((current) => {
      const exists = current.some((row) => row.id === updated.id)
      if (!exists) return current
      if (!stillMatches) return current.filter((row) => row.id !== updated.id)
      return current.map((row) => (row.id === updated.id ? updated : row))
    })

    if (!stillMatches) {
      setTotalCount((count) => Math.max(0, count - 1))
    }

    upsertMetricRow(updated)
  }

  const handleConfirm = async (booking: BookingRow) => {
    if (updatingId) return

    setUpdatingId(booking.id)

    try {
      const { data, error: rpcError } = await supabase.rpc('confirm_booking', {
        p_booking_id: booking.id,
      })

      if (rpcError) throw rpcError

      const updated = (Array.isArray(data) ? data[0] : data) as BookingRow | null

      if (updated) {
        applyUpdatedBooking(updated)
      }

      showToast(`Pembayaran ${booking.booking_code} dikonfirmasi. Booth menjadi Booked.`, 'success')
    } catch (confirmError) {
      showToast(`Gagal mengonfirmasi pembayaran: ${getBookingErrorMessage(confirmError)}`, 'error')
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
        applyUpdatedBooking(updated)
      }

      showToast(`Pesanan ${booking.booking_code} dibatalkan. Booth kembali tersedia.`, 'success')
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
        showToast(`${released} pesanan kedaluwarsa dibatalkan dan booth kembali tersedia.`, 'info')
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
    metricRows,
    totalCount,
    page,
    totalPages,
    pageStart,
    pageEnd,
    goToPage,
    loading,
    listLoading,
    error,
    retry,
    statusFilter,
    handleStatusFilterChange,
    eventFilter,
    handleEventFilterChange,
    search,
    handleSearchChange,
    filtersActive,
    handleResetFilters,
    updatingId,
    confirmingCancelId,
    setConfirmingCancelId,
    refreshing,
    handleRefresh,
    now,
    feed,
    lastUpdatedAt,
    blueprintById,
    metrics,
    handleConfirm,
    handleCancel,
  }
}

export type AdminBookingsState = ReturnType<typeof useAdminBookings>
