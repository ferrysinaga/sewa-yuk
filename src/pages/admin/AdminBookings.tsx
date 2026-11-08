import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppHeader from '../../components/layout/AppHeader'
import InlineConfirm from '../../components/ui/InlineConfirm'
import SyncStatusBadge from '../../components/ui/SyncStatusBadge'
import { ErrorPanel, LoadingPanel } from '../../components/ui/StatePanel'
import { useToast } from '../../components/ui/Toast'
import { useBookingClock } from '../../hooks/useBookingClock'
import { useBookingFeed } from '../../hooks/useBookingFeed'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { formatCurrency, formatDateTime, getBookingErrorMessage, isExpiredBooking } from '../../lib/booking'
import { sweepExpiredBookings } from '../../lib/bookingExpiry'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import {
  BOOKING_EXPIRED_BADGE,
  BOOKING_EXPIRED_DOT,
  BOOKING_EXPIRED_LABEL,
  BOOKING_STATUS_BADGE,
  BOOKING_STATUS_DOT,
  BOOKING_STATUS_LABEL,
  BOOKING_STATUS_OPTIONS,
  PAYMENT_METHOD_LABEL,
} from '../../types/booking'
import type { BookingRow, BookingStatus } from '../../types/booking'
import type { BlueprintStatus } from '../../types/blueprint'
import type { BookingRealtimePayload } from '../../lib/bookingRealtime'

const PAGE_SIZE = 25

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

const EMPTY_BLUEPRINT_IDS: string[] = []

export default function AdminBookings() {
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

  const filtersActive =
    search.trim().length > 0 || eventFilter !== 'all' || statusFilter !== 'all'

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
        ...('cancelled_reason' in row
          ? { cancelled_reason: row.cancelled_reason ?? null }
          : {}),
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
        supabase
          .from('bookings')
          .select('id, status, price, expires_at, cancelled_reason'),
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
    const awaiting = metricRows.filter(
      (row) => row.status === 'awaiting_confirmation',
    ).length
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

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader />

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2.5">
              <span aria-hidden="true" className="h-px w-6 bg-clay" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                Dashboard penyelenggara
              </p>
            </div>
            <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-4xl">
              Pemesanan Booth
            </h1>
            <p className="mt-2 text-sm text-muted">
              Verifikasi pembayaran penyewa dan pantau seluruh pesanan booth.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              to="/admin"
              className="inline-flex items-center justify-center gap-2 rounded-[8px] border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2"
            >
              Dashboard
            </Link>
            <Link
              to="/admin/blueprint"
              className="inline-flex items-center justify-center gap-2 rounded-[8px] border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2"
            >
              Kelola Denah
            </Link>
          </div>
        </div>

        {loading && (
          <LoadingPanel
            className="mt-8"
            title="Memuat pemesanan…"
            titleClassName="text-sm text-muted"
            minHeightClassName="min-h-[320px]"
          />
        )}

        {!loading && error && (
          <ErrorPanel
            className="mt-8"
            title="Gagal memuat pemesanan"
            description={error}
            onRetry={() => setReloadToken((token) => token + 1)}
          />
        )}

        {!loading && !error && (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[10px] border border-line bg-surface p-5 ">
                <p className="text-xs font-medium text-muted">Total pesanan</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">
                  {metricRows.length}
                </p>
                <p className="mt-1 text-xs text-muted">{metrics.pending} menunggu pembayaran</p>
              </div>
              <div className="rounded-[10px] border border-line bg-clay-soft p-5 ">
                <p className="text-xs font-medium text-clay-dark">Perlu verifikasi</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-clay-dark">
                  {metrics.awaiting}
                </p>
                <p className="mt-1 text-xs text-clay-dark">Penyewa sudah menandai sudah bayar</p>
              </div>
              <div className="rounded-[10px] border border-line bg-surface p-5 ">
                <p className="text-xs font-medium text-muted">Terkonfirmasi</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">
                  {metrics.confirmed}
                </p>
                <p className="mt-1 text-xs text-muted">Booth sudah menjadi Booked</p>
              </div>
              <div className="rounded-[10px] border border-line bg-surface p-5 ">
                <p className="text-xs font-medium text-muted">Pendapatan terkonfirmasi</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">
                  {formatCurrency(metrics.revenue)}
                </p>
                <p className="mt-1 text-xs text-muted">Dari pesanan terkonfirmasi</p>
              </div>
            </div>

            <section
              className="mt-6 overflow-hidden rounded-[10px] border border-line bg-surface "
              aria-busy={listLoading}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="text-base font-semibold text-ink">Daftar pemesanan</h2>
                    <SyncStatusBadge
                      status={feed.status}
                      lastUpdatedAt={lastUpdatedAt}
                      onRefresh={() => void handleRefresh()}
                      refreshing={refreshing}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {filtersActive && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="inline-flex items-center gap-1.5 rounded-[8px] border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2"
                    >
                      Reset filter
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleRefresh()}
                    disabled={refreshing}
                    className="inline-flex items-center gap-1.5 rounded-[8px] border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {refreshing ? 'Memperbarui…' : 'Perbarui status'}
                  </button>
                </div>
              </div>

              <div className="grid gap-2 border-b border-line px-5 py-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="booking-search" className="sr-only">
                    Cari pemesanan
                  </label>
                  <input
                    id="booking-search"
                    type="search"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value)
                      setPage(1)
                    }}
                    placeholder="Cari kode, tenant, event…"
                    className="w-full rounded-[8px] border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine-soft"
                  />
                </div>
                <div>
                  <label htmlFor="booking-event-filter" className="sr-only">
                    Filter event
                  </label>
                  <select
                    id="booking-event-filter"
                    value={eventFilter}
                    onChange={(event) => {
                      setEventFilter(event.target.value)
                      setPage(1)
                    }}
                    className="w-full rounded-[8px] border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine-soft"
                  >
                    <option value="all">Semua event</option>
                    {blueprints.map((blueprint) => (
                      <option key={blueprint.id} value={blueprint.id}>
                        {blueprint.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="booking-status-filter" className="sr-only">
                    Filter status
                  </label>
                  <select
                    id="booking-status-filter"
                    value={statusFilter}
                    onChange={(event) => {
                      setStatusFilter(event.target.value as BookingStatus | 'all')
                      setPage(1)
                    }}
                    className="w-full rounded-[8px] border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine-soft"
                  >
                    <option value="all">Semua status</option>
                    {BOOKING_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {BOOKING_STATUS_LABEL[status]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-[980px] w-full divide-y divide-line text-left text-sm">
                  <thead className="bg-canvas text-[11px] font-semibold uppercase tracking-wide text-muted">
                    <tr>
                      <th scope="col" className="px-5 py-3">
                        Kode
                      </th>
                      <th scope="col" className="px-5 py-3">
                        Tenant
                      </th>
                      <th scope="col" className="px-5 py-3">
                        Event
                      </th>
                      <th scope="col" className="px-5 py-3">
                        Booth
                      </th>
                      <th scope="col" className="px-5 py-3 text-right">
                        Total
                      </th>
                      <th scope="col" className="px-5 py-3">
                        Status
                      </th>
                      <th scope="col" className="px-5 py-3">
                        Dibuat
                      </th>
                      <th scope="col" className="px-5 py-3 text-right">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {bookings.map((booking) => {
                      const event = blueprintById.get(booking.blueprint_id)
                      const isUpdating = updatingId === booking.id
                      const expired = isExpiredBooking(booking, now)
                      const canCancel =
                        booking.status === 'pending' ||
                        booking.status === 'awaiting_confirmation'
                      const canConfirm = canCancel && !expired
                      const bookingStatusLabel = expired
                        ? BOOKING_EXPIRED_LABEL
                        : BOOKING_STATUS_LABEL[booking.status]
                      const statusBadge = expired
                        ? BOOKING_EXPIRED_BADGE
                        : BOOKING_STATUS_BADGE[booking.status]
                      const statusDot = expired
                        ? BOOKING_EXPIRED_DOT
                        : BOOKING_STATUS_DOT[booking.status]

                      const confirmingCancel = confirmingCancelId === booking.id

                      return (
                        <Fragment key={booking.id}>
                          <tr className="transition-colors hover:bg-canvas">
                            <td className="whitespace-nowrap px-5 py-3.5">
                            <p className="font-mono text-xs font-semibold text-ink">
                              {booking.booking_code}
                            </p>
                            <p className="mt-0.5 text-[11px] text-muted">
                              {PAYMENT_METHOD_LABEL[booking.payment_method]}
                            </p>
                          </td>
                          <td className="px-5 py-3.5">
                            <p className="max-w-[180px] truncate text-xs font-medium text-ink">
                              {booking.tenant_name || 'Tanpa nama'}
                            </p>
                            <p className="max-w-[180px] truncate text-[11px] text-muted">
                              {booking.tenant_email || '—'}
                            </p>
                          </td>
                          <td className="px-5 py-3.5">
                            <p className="max-w-[200px] truncate text-xs font-medium text-ink">
                              {event?.name ?? booking.blueprint_id}
                            </p>
                            <p className="max-w-[200px] truncate text-[11px] text-muted">
                              {event?.venue ?? '—'}
                            </p>
                          </td>
                          <td className="whitespace-nowrap px-5 py-3.5">
                            <span className="inline-flex rounded-full bg-unavailable px-2.5 py-1 text-[11px] font-medium text-ink ring-1 ring-inset ring-line">
                              {booking.booth_category}
                            </span>
                            <p className="mt-1 font-mono text-[11px] text-muted">
                              {booking.booth_id ? booking.booth_id.slice(0, 8) : 'booth dihapus'}
                            </p>
                          </td>
                          <td className="whitespace-nowrap px-5 py-3.5 text-right text-xs font-medium text-ink">
                            {formatCurrency(booking.price)}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3.5">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${statusBadge}`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
                              {bookingStatusLabel}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-5 py-3.5 text-[11px] text-muted">
                            {formatDateTime(booking.created_at)}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3.5">
                            <div className="flex items-center justify-end gap-2">
                              {canCancel ? (
                                <>
                                  {canConfirm && (
                                    <button
                                      type="button"
                                      onClick={() => void handleConfirm(booking)}
                                      disabled={isUpdating}
                                      className="rounded-[8px] bg-pine px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {isUpdating ? 'Memproses…' : 'Konfirmasi'}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setConfirmingCancelId(booking.id)}
                                    disabled={isUpdating}
                                    aria-expanded={confirmingCancel}
                                    aria-controls={`cancel-booking-${booking.id}`}
                                    className="rounded-[8px] px-2 py-1.5 text-[11px] font-semibold text-muted transition-colors hover:bg-danger-soft hover:text-danger-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    Batalkan
                                  </button>
                                </>
                              ) : (
                                <span className="text-[11px] text-muted">—</span>
                              )}
                            </div>
                          </td>
                          </tr>

                          {confirmingCancel && (
                            <tr className="bg-canvas">
                              <td colSpan={8} className="px-5 py-3">
                                <InlineConfirm
                                  id={`cancel-booking-${booking.id}`}
                                  title={`Batalkan pesanan ${booking.booking_code}?`}
                                  description="Booth akan tersedia kembali untuk penyewa lain. Tindakan ini tidak dapat dibatalkan."
                                  confirmLabel="Ya, batalkan pesanan"
                                  onConfirm={() => void handleCancel(booking)}
                                  onCancel={() => setConfirmingCancelId(null)}
                                />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {!listLoading && bookings.length === 0 && (
                <div className="border-t border-line px-6 py-10 text-center">
                  <p className="text-sm font-semibold text-ink">
                    {totalCount === 0 && !filtersActive
                      ? 'Belum ada pemesanan'
                      : 'Tidak ada pesanan yang cocok'}
                  </p>
                  <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted">
                    {totalCount === 0 && !filtersActive
                      ? 'Pemesanan dari tenant akan muncul di sini setelah mereka memilih booth.'
                      : 'Coba ubah kata kunci atau filter event dan status.'}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
                <p className="text-xs tabular-nums text-muted" aria-live="polite">
                  {listLoading
                    ? 'Memuat pesanan…'
                    : totalCount === 0
                      ? 'Tidak ada pesanan'
                      : `${pageStart}-${pageEnd} dari ${totalCount} pesanan`}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => goToPage(page - 1)}
                    disabled={page <= 1 || listLoading}
                    aria-label="Halaman sebelumnya"
                    className="inline-flex items-center gap-1.5 rounded-[8px] border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Sebelumnya
                  </button>
                  <span className="text-xs tabular-nums text-muted">
                    Halaman {page} dari {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => goToPage(page + 1)}
                    disabled={page >= totalPages || listLoading}
                    aria-label="Halaman berikutnya"
                    className="inline-flex items-center gap-1.5 rounded-[8px] border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Berikutnya
                  </button>
                </div>
              </div>
            </section>

            <p className="mt-6 text-center text-[11px] text-muted">
              Verifikasi pembayaran akan mengubah status booth menjadi Booked secara otomatis.
            </p>
          </>
        )}
      </main>
    </div>
  )
}
