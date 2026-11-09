import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppHeader from '../../components/layout/AppHeader'
import InlineConfirm from '../../components/ui/InlineConfirm'
import { useToast } from '../../components/ui/Toast'
import { useBookingFeed } from '../../hooks/useBookingFeed'
import {
  formatCurrency,
  formatDateTime,
  getBookingErrorMessage,
  getPaymentInstruction,
  isExpiredBooking,
} from '../../lib/booking'
import { sweepExpiredBookings } from '../../lib/bookingExpiry'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/useAuthStore'
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

interface BlueprintSummaryRow {
  id: string
  name: string
  venue: string | null
  event_date: string | null
}

const statusFilters: (BookingStatus | 'all')[] = ['all', ...BOOKING_STATUS_OPTIONS]

export default function TenantBookings() {
  const user = useAuthStore((state) => state.user)
  const { showToast } = useToast()

  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [blueprints, setBlueprints] = useState<BlueprintSummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [confirmingCancelId, setConfirmingCancelId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useBookingFeed({ userId: user?.id ?? null, setBookings, enabled: Boolean(user) })

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
      setLoading(false)
    }

    void loadBookings()

    return () => {
      cancelled = true
    }
  }, [reloadToken, user])

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
        (booking.status === 'pending' && !isExpiredBooking(booking)),
    ).length
    const confirmed = bookings.filter((booking) => booking.status === 'confirmed')
    const totalPaid = confirmed.reduce((sum, booking) => sum + booking.price, 0)

    return { active, confirmed: confirmed.length, totalPaid }
  }, [bookings])

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

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader />

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2.5">
              <span aria-hidden="true" className="h-px w-6 bg-clay" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                Riwayat penyewaan
              </p>
            </div>
            <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-4xl">
              Pesanan Saya
            </h1>
            <p className="mt-2 text-sm text-muted">
              Pantau status pemesanan booth dan selesaikan pembayaran sebelum batas waktu.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={refreshing || loading}
              className="inline-flex items-center justify-center gap-2 rounded-[8px] border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? 'Memperbarui…' : 'Perbarui status'}
            </button>
            <Link
              to="/event"
              className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-pine px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2"
            >
              Jelajahi Event
            </Link>
          </div>
        </div>

        {loading && (
          <div className="mt-8 flex min-h-[280px] items-center justify-center rounded-[10px] border border-line bg-surface ">
            <div className="flex flex-col items-center gap-3">
              <span
                aria-hidden="true"
                className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-pine"
              />
              <p className="text-sm text-muted">Memuat pesanan…</p>
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
            <h2 className="mt-4 text-lg font-semibold text-ink">Gagal memuat pesanan</h2>
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
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[10px] border border-line bg-surface p-5 ">
                <p className="text-xs font-medium text-muted">Pesanan aktif</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">
                  {metrics.active}
                </p>
                <p className="mt-1 text-xs text-muted">Menunggu pembayaran atau verifikasi</p>
              </div>
              <div className="rounded-[10px] border border-line bg-surface p-5 ">
                <p className="text-xs font-medium text-muted">Terkonfirmasi</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">
                  {metrics.confirmed}
                </p>
                <p className="mt-1 text-xs text-muted">Booth sudah menjadi milik Anda</p>
              </div>
              <div className="rounded-[10px] border border-line bg-surface p-5 ">
                <p className="text-xs font-medium text-muted">Total dibayar</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">
                  {formatCurrency(metrics.totalPaid)}
                </p>
                <p className="mt-1 text-xs text-muted">Dari pesanan terkonfirmasi</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filter status pesanan">
              {statusFilters.map((status) => {
                const isActive = statusFilter === status
                const count =
                  status === 'all'
                    ? bookings.length
                    : bookings.filter((booking) => booking.status === status).length

                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    aria-pressed={isActive}
                    className={`inline-flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 ${
                      isActive
                        ? 'bg-pine text-white ring-pine'
                        : 'bg-surface text-muted ring-line hover:bg-canvas'
                    }`}
                  >
                    {status === 'all' ? 'Semua' : BOOKING_STATUS_LABEL[status]}
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        isActive ? 'bg-pine-dark text-white' : 'bg-unavailable text-muted'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            {visibleBookings.length === 0 ? (
              <div className="mt-6 rounded-[10px] border border-line bg-surface p-10 text-center ">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[10px] bg-pine-soft text-pine">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 4H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V18a2 2 0 0 1-2 2Z" />
                  </svg>
                </div>
                <h2 className="mt-4 text-lg font-semibold text-ink">
                  {bookings.length === 0 ? 'Belum ada pesanan' : 'Tidak ada pesanan pada filter ini'}
                </h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
                  {bookings.length === 0
                    ? 'Pilih booth pada peta event untuk membuat pesanan pertama Anda.'
                    : 'Coba pilih filter status lain untuk melihat pesanan Anda.'}
                </p>
                {bookings.length === 0 && (
                  <Link
                    to="/event"
                    className="mt-5 inline-flex items-center justify-center rounded-[8px] bg-pine px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2"
                  >
                    Cari Booth
                  </Link>
                )}
              </div>
            ) : (
              <ul className="mt-6 space-y-4">
                {visibleBookings.map((booking) => {
                  const event = blueprintById.get(booking.blueprint_id)
                  const expired = isExpiredBooking(booking)
                  const instruction =
                    booking.status === 'pending' && !expired
                      ? getPaymentInstruction(booking.payment_method, booking)
                      : null
                  const isUpdating = updatingId === booking.id
                  const confirmingCancel = confirmingCancelId === booking.id
                  const bookingStatusLabel = expired
                    ? BOOKING_EXPIRED_LABEL
                    : BOOKING_STATUS_LABEL[booking.status]
                  const statusBadge = expired
                    ? BOOKING_EXPIRED_BADGE
                    : BOOKING_STATUS_BADGE[booking.status]
                  const statusDot = expired
                    ? BOOKING_EXPIRED_DOT
                    : BOOKING_STATUS_DOT[booking.status]

                  return (
                    <li
                      key={booking.id}
                      className="overflow-hidden rounded-[10px] border border-line bg-surface "
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-ink">
                              {booking.booking_code}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${statusBadge}`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
                              {bookingStatusLabel}
                            </span>
                          </div>
                          <p className="mt-1 text-sm font-semibold text-ink">
                            {event?.name ?? booking.blueprint_id}
                          </p>
                          <p className="mt-0.5 text-xs text-muted">
                            {[event?.venue, event?.event_date].filter(Boolean).join(' · ') ||
                              'Detail event tidak tersedia'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted">Total</p>
                          <p className="text-base font-semibold text-ink">
                            {formatCurrency(booking.price)}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
                        <dl className="space-y-2 text-xs">
                          <div className="flex items-center justify-between gap-3">
                            <dt className="text-muted">Booth</dt>
                            <dd className="font-semibold text-ink">
                              {booking.booth_category}
                              {booking.booth_id ? ` · ${booking.booth_id.slice(0, 8)}` : ''}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <dt className="text-muted">Metode pembayaran</dt>
                            <dd className="font-semibold text-ink">
                              {PAYMENT_METHOD_LABEL[booking.payment_method]}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <dt className="text-muted">Dipesan</dt>
                            <dd className="font-medium text-ink">
                              {formatDateTime(booking.reserved_at)}
                            </dd>
                          </div>
                          {booking.expires_at &&
                            (booking.status === 'pending' ||
                              booking.status === 'awaiting_confirmation') && (
                              <div className="flex items-center justify-between gap-3">
                                <dt className="text-muted">
                                  {expired ? 'Batas pembayaran (terlewat)' : 'Batas pembayaran'}
                                </dt>
                                <dd className="font-medium text-clay-dark">
                                  {formatDateTime(booking.expires_at)}
                                </dd>
                              </div>
                            )}
                          {booking.status === 'confirmed' && (
                            <div className="flex items-center justify-between gap-3">
                              <dt className="text-muted">Dibayar</dt>
                              <dd className="font-medium text-pine-dark">
                                {formatDateTime(booking.paid_at)}
                              </dd>
                            </div>
                          )}
                          {booking.status === 'cancelled' && (
                            <div className="flex items-center justify-between gap-3">
                              <dt className="text-muted">
                                {booking.cancelled_reason === 'expired'
                                  ? 'Kedaluwarsa'
                                  : 'Dibatalkan'}
                              </dt>
                              <dd className="font-medium text-ink">
                                {formatDateTime(booking.cancelled_at)}
                              </dd>
                            </div>
                          )}
                        </dl>

                        <div>
                          {expired && booking.status === 'pending' && (
                            <div className="rounded-[8px] border border-line bg-clay-soft p-3 text-xs leading-relaxed text-clay-dark">
                              Batas pembayaran sudah lewat. Pesanan akan dibatalkan otomatis dan
                              booth dilepas untuk penyewa lain. Tekan tombol Perbarui status untuk
                              memperbarui sekarang.
                            </div>
                          )}

                          {instruction && (
                            <div className="rounded-[8px] border border-line bg-clay-soft p-3">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-clay-dark">
                                Instruksi pembayaran · {instruction.title}
                              </p>
                              <ul className="mt-2 space-y-1 text-xs text-ink">
                                {instruction.lines.map((line) => (
                                  <li key={line} className="font-medium">
                                    {line}
                                  </li>
                                ))}
                              </ul>
                              <p className="mt-2 text-[11px] leading-relaxed text-clay-dark">
                                {instruction.note}
                              </p>
                            </div>
                          )}

                          {booking.status === 'awaiting_confirmation' && (
                            <div className="rounded-[8px] border border-line bg-pine-soft p-3 text-xs leading-relaxed text-pine-dark">
                              Konfirmasi pembayaran sudah dikirim. Organizer akan memverifikasi dan
                              mengubah status booth menjadi Booked.
                            </div>
                          )}

                          {booking.status === 'confirmed' && (
                            <div className="rounded-[8px] border border-line bg-pine-soft p-3 text-xs leading-relaxed text-pine-dark">
                              Pembayaran terverifikasi. Booth sudah resmi menjadi milik Anda pada event
                              ini.
                            </div>
                          )}

                          {booking.status === 'cancelled' && (
                            <div className="rounded-[8px] border border-line bg-unavailable p-3 text-xs leading-relaxed text-muted">
                              {booking.cancelled_reason === 'expired'
                                ? 'Pesanan kedaluwarsa karena batas pembayaran terlewat. Booth sudah dilepas dan dapat dipesan penyewa lain.'
                                : 'Pesanan dibatalkan. Booth sudah dilepas dan dapat dipesan penyewa lain.'}
                            </div>
                          )}
                        </div>
                      </div>

                      {(booking.status === 'pending' ||
                        booking.status === 'awaiting_confirmation') && (
                        <div className="border-t border-line px-5 py-3">
                          {confirmingCancel ? (
                            <InlineConfirm
                              id={`cancel-booking-${booking.id}`}
                              title="Batalkan pesanan ini?"
                              description="Booth akan tersedia kembali untuk penyewa lain. Tindakan ini tidak dapat dibatalkan."
                              confirmLabel="Ya, batalkan pesanan"
                              onConfirm={() => void handleCancel(booking)}
                              onCancel={() => setConfirmingCancelId(null)}
                              className="rounded-[8px] border border-danger bg-danger-soft p-3"
                            />
                          ) : (
                            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                              <button
                                type="button"
                                onClick={() => setConfirmingCancelId(booking.id)}
                                disabled={isUpdating}
                                aria-expanded={confirmingCancel}
                                aria-controls={`cancel-booking-${booking.id}`}
                                className="inline-flex items-center justify-center rounded-[8px] border border-line bg-surface px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-danger hover:bg-danger-soft hover:text-danger-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Batalkan Pesanan
                              </button>
                              {booking.status === 'pending' && !expired && (
                                <button
                                  type="button"
                                  onClick={() => void handleMarkPaid(booking)}
                                  disabled={isUpdating}
                                  className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-pine px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {isUpdating ? 'Mengirim…' : 'Saya Sudah Bayar'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            {bookings.length > 0 && (
              <p className="mt-6 text-center text-[11px] text-muted">
                Pembayaran pada aplikasi ini masih berupa simulasi. Organizer memverifikasi pesanan
                secara manual.
              </p>
            )}
          </>
        )}
      </main>
    </div>
  )
}
