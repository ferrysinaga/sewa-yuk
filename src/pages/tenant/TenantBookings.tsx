import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppHeader from '../../components/layout/AppHeader'
import { useToast } from '../../components/ui/Toast'
import {
  formatCurrency,
  formatDateTime,
  getBookingErrorMessage,
  getPaymentInstruction,
} from '../../lib/booking'
import { createChannelName } from '../../lib/id'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/useAuthStore'
import {
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

interface BookingChangePayload {
  eventType?: 'INSERT' | 'UPDATE' | 'DELETE'
  new?: Partial<BookingRow>
  old?: Partial<BookingRow>
}

const statusFilters: (BookingStatus | 'all')[] = ['all', ...BOOKING_STATUS_OPTIONS]

function applyBookingChange(current: BookingRow[], payload: BookingChangePayload): BookingRow[] {
  if (payload.eventType === 'DELETE') {
    const deletedId = payload.old?.id
    return deletedId ? current.filter((booking) => booking.id !== deletedId) : current
  }

  const row = payload.new
  if (!row?.id) return current

  const updated = row as BookingRow
  return current.some((booking) => booking.id === updated.id)
    ? current.map((booking) => (booking.id === updated.id ? updated : booking))
    : [updated, ...current]
}

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

  useEffect(() => {
    if (!user || !isSupabaseConfigured) return

    const channel = supabase
      .channel(createChannelName(`tenant-bookings-${user.id}`))
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setBookings((current) => applyBookingChange(current, payload as BookingChangePayload))
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('Koneksi realtime pemesanan gagal. Perubahan status mungkin tertunda.')
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user])

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
      (booking) => booking.status === 'pending' || booking.status === 'awaiting_confirmation',
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

    const confirmed = window.confirm(
      'Batalkan pesanan ini? Booth akan tersedia kembali untuk penyewa lain.',
    )

    if (!confirmed) return

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

  return (
    <div className="min-h-screen bg-gray-50/60">
      <AppHeader />

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-gray-500">Riwayat penyewaan</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
              Pesanan Saya
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Pantau status pemesanan booth dan selesaikan pembayaran sebelum batas waktu.
            </p>
          </div>
          <Link
            to="/event"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            Jelajahi Event
          </Link>
        </div>

        {loading && (
          <div className="mt-8 flex min-h-[280px] items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-col items-center gap-3">
              <span
                aria-hidden="true"
                className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600"
              />
              <p className="text-sm text-gray-500">Memuat pesanan…</p>
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008ZM10.34 3.94 2.7 17.54A1.5 1.5 0 0 0 4 19.75h16a1.5 1.5 0 0 0 1.3-2.21L13.66 3.94a1.5 1.5 0 0 0-2.62 0Z" />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-gray-900">Gagal memuat pesanan</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-500">{error}</p>
            <button
              type="button"
              onClick={() => setReloadToken((token) => token + 1)}
              className="mt-5 inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              Coba lagi
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-medium text-gray-500">Pesanan aktif</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">
                  {metrics.active}
                </p>
                <p className="mt-1 text-xs text-gray-500">Menunggu pembayaran atau verifikasi</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-medium text-gray-500">Terkonfirmasi</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">
                  {metrics.confirmed}
                </p>
                <p className="mt-1 text-xs text-gray-500">Booth sudah menjadi milik Anda</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-medium text-gray-500">Total dibayar</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">
                  {formatCurrency(metrics.totalPaid)}
                </p>
                <p className="mt-1 text-xs text-gray-500">Dari pesanan terkonfirmasi</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
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
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
                      isActive
                        ? 'bg-blue-600 text-white ring-blue-600'
                        : 'bg-white text-gray-600 ring-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {status === 'all' ? 'Semua' : BOOKING_STATUS_LABEL[status]}
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            {visibleBookings.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 4H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V18a2 2 0 0 1-2 2Z" />
                  </svg>
                </div>
                <h2 className="mt-4 text-lg font-semibold text-gray-900">
                  {bookings.length === 0 ? 'Belum ada pesanan' : 'Tidak ada pesanan pada filter ini'}
                </h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-gray-500">
                  {bookings.length === 0
                    ? 'Pilih booth pada peta event untuk membuat pesanan pertama Anda.'
                    : 'Coba pilih filter status lain untuk melihat pesanan Anda.'}
                </p>
                {bookings.length === 0 && (
                  <Link
                    to="/event"
                    className="mt-5 inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                  >
                    Cari Booth
                  </Link>
                )}
              </div>
            ) : (
              <ul className="mt-6 space-y-4">
                {visibleBookings.map((booking) => {
                  const event = blueprintById.get(booking.blueprint_id)
                  const instruction =
                    booking.status === 'pending'
                      ? getPaymentInstruction(booking.payment_method, booking)
                      : null
                  const isUpdating = updatingId === booking.id

                  return (
                    <li
                      key={booking.id}
                      className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-gray-900">
                              {booking.booking_code}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${BOOKING_STATUS_BADGE[booking.status]}`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${BOOKING_STATUS_DOT[booking.status]}`}
                              />
                              {BOOKING_STATUS_LABEL[booking.status]}
                            </span>
                          </div>
                          <p className="mt-1 text-sm font-semibold text-gray-900">
                            {event?.name ?? booking.blueprint_id}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {[event?.venue, event?.event_date].filter(Boolean).join(' · ') ||
                              'Detail event tidak tersedia'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Total</p>
                          <p className="text-base font-semibold text-gray-900">
                            {formatCurrency(booking.price)}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
                        <dl className="space-y-2 text-xs">
                          <div className="flex items-center justify-between gap-3">
                            <dt className="text-gray-500">Booth</dt>
                            <dd className="font-semibold text-gray-900">
                              {booking.booth_category}
                              {booking.booth_id ? ` · ${booking.booth_id.slice(0, 8)}` : ''}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <dt className="text-gray-500">Metode pembayaran</dt>
                            <dd className="font-semibold text-gray-900">
                              {PAYMENT_METHOD_LABEL[booking.payment_method]}
                            </dd>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <dt className="text-gray-500">Dipesan</dt>
                            <dd className="font-medium text-gray-900">
                              {formatDateTime(booking.reserved_at)}
                            </dd>
                          </div>
                          {booking.expires_at &&
                            (booking.status === 'pending' ||
                              booking.status === 'awaiting_confirmation') && (
                              <div className="flex items-center justify-between gap-3">
                                <dt className="text-gray-500">Batas pembayaran</dt>
                                <dd className="font-medium text-amber-700">
                                  {formatDateTime(booking.expires_at)}
                                </dd>
                              </div>
                            )}
                          {booking.status === 'confirmed' && (
                            <div className="flex items-center justify-between gap-3">
                              <dt className="text-gray-500">Dibayar</dt>
                              <dd className="font-medium text-emerald-700">
                                {formatDateTime(booking.paid_at)}
                              </dd>
                            </div>
                          )}
                          {booking.status === 'cancelled' && (
                            <div className="flex items-center justify-between gap-3">
                              <dt className="text-gray-500">Dibatalkan</dt>
                              <dd className="font-medium text-gray-700">
                                {formatDateTime(booking.cancelled_at)}
                              </dd>
                            </div>
                          )}
                        </dl>

                        <div>
                          {instruction && (
                            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                                Instruksi pembayaran · {instruction.title}
                              </p>
                              <ul className="mt-2 space-y-1 text-xs text-gray-700">
                                {instruction.lines.map((line) => (
                                  <li key={line} className="font-medium">
                                    {line}
                                  </li>
                                ))}
                              </ul>
                              <p className="mt-2 text-[11px] leading-relaxed text-amber-800/80">
                                {instruction.note}
                              </p>
                            </div>
                          )}

                          {booking.status === 'awaiting_confirmation' && (
                            <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-xs leading-relaxed text-blue-800">
                              Konfirmasi pembayaran sudah dikirim. Organizer akan memverifikasi dan
                              mengubah status booth menjadi Booked.
                            </div>
                          )}

                          {booking.status === 'confirmed' && (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs leading-relaxed text-emerald-800">
                              Pembayaran terverifikasi. Booth sudah resmi menjadi milik Anda pada event
                              ini.
                            </div>
                          )}

                          {booking.status === 'cancelled' && (
                            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs leading-relaxed text-gray-600">
                              Pesanan dibatalkan. Booth sudah dilepas dan dapat dipesan penyewa lain.
                            </div>
                          )}
                        </div>
                      </div>

                      {(booking.status === 'pending' ||
                        booking.status === 'awaiting_confirmation') && (
                        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 px-5 py-3 sm:flex-row sm:justify-end">
                          <button
                            type="button"
                            onClick={() => void handleCancel(booking)}
                            disabled={isUpdating}
                            className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 shadow-sm transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Batalkan Pesanan
                          </button>
                          {booking.status === 'pending' && (
                            <button
                              type="button"
                              onClick={() => void handleMarkPaid(booking)}
                              disabled={isUpdating}
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isUpdating ? 'Mengirim…' : 'Saya Sudah Bayar'}
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            {bookings.length > 0 && (
              <p className="mt-6 text-center text-[11px] text-gray-500">
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
