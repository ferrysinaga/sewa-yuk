import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppHeader from '../../components/layout/AppHeader'
import InlineConfirm from '../../components/ui/InlineConfirm'
import { useToast } from '../../components/ui/Toast'
import { useBookingFeed } from '../../hooks/useBookingFeed'
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

interface BlueprintSummaryRow {
  id: string
  name: string
  venue: string | null
  event_date: string | null
  status: BlueprintStatus
}

export default function AdminBookings() {
  const { showToast } = useToast()

  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [blueprints, setBlueprints] = useState<BlueprintSummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all')
  const [eventFilter, setEventFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [confirmingCancelId, setConfirmingCancelId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const isLive = useBookingFeed({ userId: null, setBookings })

  useEffect(() => {
    let cancelled = false

    if (!isSupabaseConfigured) {
      setError('Supabase belum dikonfigurasi. Isi kredensial pada file .env terlebih dahulu.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const loadBookings = async () => {
      // Lepas booking kedaluwarsa lebih dulu agar daftar dan status booth
      // konsisten meskipun pg_cron belum aktif.
      await sweepExpiredBookings()

      if (cancelled) return

      const [bookingResult, blueprintResult] = await Promise.all([
        supabase.from('bookings').select('*').order('created_at', { ascending: false }),
        supabase.from('blueprints').select('id, name, venue, event_date, status'),
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
      setLoading(false)
    }

    void loadBookings()

    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const blueprintById = useMemo(
    () => new Map(blueprints.map((blueprint) => [blueprint.id, blueprint])),
    [blueprints],
  )

  const filteredBookings = useMemo(() => {
    const term = search.trim().toLowerCase()

    return bookings.filter((booking) => {
      if (statusFilter !== 'all' && booking.status !== statusFilter) return false
      if (eventFilter !== 'all' && booking.blueprint_id !== eventFilter) return false

      if (term) {
        const eventName = blueprintById.get(booking.blueprint_id)?.name ?? booking.blueprint_id
        const haystack =
          `${booking.booking_code} ${booking.tenant_name ?? ''} ${booking.tenant_email ?? ''} ${booking.booth_category} ${eventName}`.toLowerCase()

        if (!haystack.includes(term)) return false
      }

      return true
    })
  }, [blueprintById, bookings, eventFilter, search, statusFilter])

  const metrics = useMemo(() => {
    const awaiting = bookings.filter(
      (booking) => booking.status === 'awaiting_confirmation',
    ).length
    const pending = bookings.filter(
      (booking) => booking.status === 'pending' && !isExpiredBooking(booking),
    ).length
    const confirmed = bookings.filter((booking) => booking.status === 'confirmed')
    const revenue = confirmed.reduce((sum, booking) => sum + booking.price, 0)

    return { awaiting, pending, confirmed: confirmed.length, revenue }
  }, [bookings])

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
        setBookings((current) =>
          current.map((row) => (row.id === updated.id ? updated : row)),
        )
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
        setBookings((current) =>
          current.map((row) => (row.id === updated.id ? updated : row)),
        )
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
          <div className="mt-8 flex min-h-[320px] items-center justify-center rounded-[10px] border border-line bg-surface ">
            <div className="flex flex-col items-center gap-3">
              <span
                aria-hidden="true"
                className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-pine"
              />
              <p className="text-sm text-muted">Memuat pemesanan…</p>
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="mt-8 rounded-[10px] border border-line bg-surface p-8 text-center ">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[10px] bg-danger-soft text-danger">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008ZM10.34 3.94 2.7 17.54A1.5 1.5 0 0 0 4 19.75h16a1.5 1.5 0 0 0 1.3-2.21L13.66 3.94a1.5 1.5 0 0 0-2.62 0Z" />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-ink">Gagal memuat pemesanan</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">{error}</p>
            <button
              type="button"
              onClick={() => setReloadToken((token) => token + 1)}
              className="mt-5 inline-flex items-center justify-center rounded-[8px] bg-pine px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2"
            >
              Coba lagi
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[10px] border border-line bg-surface p-5 ">
                <p className="text-xs font-medium text-muted">Total pesanan</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">
                  {bookings.length}
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

            <section className="mt-6 overflow-hidden rounded-[10px] border border-line bg-surface ">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="text-base font-semibold text-ink">Daftar pemesanan</h2>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${
                        isLive
                          ? 'bg-pine-soft text-pine-dark ring-line'
                          : 'bg-unavailable text-muted ring-line'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isLive ? ' bg-pine' : 'bg-muted'
                        }`}
                      />
                      {isLive ? 'Live' : 'Menghubungkan…'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {filteredBookings.length} dari {bookings.length} pesanan ditampilkan
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleRefresh()}
                  disabled={refreshing}
                  className="inline-flex items-center gap-1.5 rounded-[8px] border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {refreshing ? 'Memperbarui…' : 'Perbarui status'}
                </button>
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
                    onChange={(event) => setSearch(event.target.value)}
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
                    onChange={(event) => setEventFilter(event.target.value)}
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
                    onChange={(event) =>
                      setStatusFilter(event.target.value as BookingStatus | 'all')
                    }
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
                    {filteredBookings.map((booking) => {
                      const event = blueprintById.get(booking.blueprint_id)
                      const isUpdating = updatingId === booking.id
                      const expired = isExpiredBooking(booking)
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

              {filteredBookings.length === 0 && (
                <div className="border-t border-line px-6 py-10 text-center">
                  <p className="text-sm font-semibold text-ink">
                    {bookings.length === 0 ? 'Belum ada pemesanan' : 'Tidak ada pesanan yang cocok'}
                  </p>
                  <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted">
                    {bookings.length === 0
                      ? 'Pemesanan dari tenant akan muncul di sini setelah mereka memilih booth.'
                      : 'Coba ubah kata kunci atau filter event dan status.'}
                  </p>
                </div>
              )}
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
