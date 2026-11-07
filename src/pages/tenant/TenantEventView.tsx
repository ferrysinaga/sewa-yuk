import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import CheckoutModal from '../../components/checkout/CheckoutModal'
import AppHeader from '../../components/layout/AppHeader'
import InteractiveMap from '../../components/map/InteractiveMap'
import TenantSidebar from '../../components/map/TenantSidebar'
import SyncStatusBadge from '../../components/ui/SyncStatusBadge'
import { useToast } from '../../components/ui/Toast'
import { getBookingErrorMessage } from '../../lib/booking'
import { sweepExpiredBookings } from '../../lib/bookingExpiry'
import { isCompleteBoothRow, mapRowToBooth } from '../../lib/boothRow'
import type { BoothRow } from '../../lib/boothRow'
import { createChannelName } from '../../lib/id'
import { resolveRealtimeStatus } from '../../lib/realtimeStatus'
import type { RealtimeStatus } from '../../lib/realtimeStatus'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/useAuthStore'
import { useBoothStore } from '../../store/useBoothStore'
import { BLUEPRINT_STATUS_BADGE, BLUEPRINT_STATUS_LABEL } from '../../types/blueprint'
import type { BlueprintStatus } from '../../types/blueprint'
import type { BookingRow, PaymentMethod } from '../../types/booking'
import type { BoothCategory } from '../../types/booth'

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

function ArrowLeft() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M16 10H5m4-4-4 4 4 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function TenantEventView() {
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
              `Booth ${row.category ?? ''} baru saja dikunci oleh penyewa lain.`.replace(/\s+/g, ' '),
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

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <AppHeader />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <Link
          to="/event"
          className="inline-flex items-center gap-1.5 rounded-[4px] text-sm font-medium text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none"
        >
          <ArrowLeft />
          Kembali ke daftar event
        </Link>

        <div className="mt-4 flex flex-col justify-between gap-5 border-b border-line pb-6 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span aria-hidden="true" className="h-px w-6 bg-clay" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                Denah acara
              </p>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-3xl">
                {blueprint?.name ?? 'Memuat event…'}
              </h1>
              {blueprint && blueprint.status !== 'published' && (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${BLUEPRINT_STATUS_BADGE[blueprint.status]}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      blueprint.status === 'draft' ? 'bg-clay' : 'bg-muted'
                    }`}
                  />
                  {role === 'organizer' ? 'Pratinjau organizer' : BLUEPRINT_STATUS_LABEL[blueprint.status]}
                </span>
              )}
              <SyncStatusBadge
                status={syncStatus}
                lastUpdatedAt={lastSyncedAt}
                onRefresh={() => setReloadToken((token) => token + 1)}
                refreshing={loading}
              />
            </div>

            {blueprint ? (
              <p className="mt-2 text-sm tabular-nums text-muted">
                {[blueprint.venue, blueprint.event_date].filter(Boolean).join(' · ')}
              </p>
            ) : (
              <div aria-hidden="true" className="mt-2 h-4 w-64 rounded-[3px] bg-unavailable" />
            )}

            {blueprint?.description && (
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
                {blueprint.description}
              </p>
            )}
          </div>

          {blueprint && !loading && !error && (
            <div className="w-full shrink-0 rounded-[10px] border border-line bg-surface px-5 py-4 sm:w-auto sm:min-w-[220px]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                Ketersediaan
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
                {availableCount}
                <span className="ml-1 text-sm font-medium text-muted">/ {totalBooths} booth</span>
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">
                {reservedCount > 0
                  ? `${reservedCount} booth sedang dipesan penyewa lain.`
                  : 'Semua booth tersedia untuk dipilih.'}
              </p>
            </div>
          )}
        </div>

        {loading && (
          <div className="mt-6 flex min-h-[420px] items-center justify-center rounded-[10px] border border-line bg-surface px-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <span
                aria-hidden="true"
                className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-pine"
              />
              <p className="text-sm font-medium text-ink">Memuat denah event…</p>
              <p className="max-w-xs text-xs leading-relaxed text-muted">
                Mengambil data blueprint dan booth dari Supabase.
              </p>
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="mt-6 rounded-[10px] border border-line bg-surface p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[8px] bg-clay-soft text-clay-dark">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008ZM10.34 3.94 2.7 17.54A1.5 1.5 0 0 0 4 19.75h16a1.5 1.5 0 0 0 1.3-2.21L13.66 3.94a1.5 1.5 0 0 0-2.62 0Z" />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-ink">Gagal memuat event</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">{error}</p>
            <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setReloadToken((token) => token + 1)}
                className="inline-flex items-center justify-center rounded-[6px] bg-pine px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none"
              >
                Coba lagi
              </button>
              <Link
                to="/event"
                className="inline-flex items-center justify-center rounded-[6px] border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none"
              >
                Kembali ke daftar event
              </Link>
            </div>
          </div>
        )}

        {!loading && !error && (
          <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <InteractiveMap activeCategory={activeCategory} />
            <TenantSidebar
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
              onReserve={handleOpenCheckout}
              reserving={reserving}
              reservedBoothId={reservedBoothId}
            />
          </div>
        )}
      </main>

      {checkoutOpen && activeBooth && (
        <CheckoutModal
          booth={activeBooth}
          eventName={blueprint?.name}
          reserved={reservedBoothId === activeBooth.id}
          bookingCode={reservedBooking?.booking_code ?? null}
          confirming={reserving}
          onClose={handleCloseCheckout}
          onConfirm={handleConfirmCheckout}
          onViewBookings={() => navigate('/bookings')}
        />
      )}
    </div>
  )
}
