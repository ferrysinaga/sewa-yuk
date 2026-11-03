import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import CheckoutModal from '../../components/checkout/CheckoutModal'
import AppHeader from '../../components/layout/AppHeader'
import InteractiveMap from '../../components/map/InteractiveMap'
import TenantSidebar from '../../components/map/TenantSidebar'
import { useToast } from '../../components/ui/Toast'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/useAuthStore'
import { useBoothStore } from '../../store/useBoothStore'
import type { Booth, BoothCategory, BoothStatus } from '../../types/booth'

interface BlueprintRow {
  id: string
  name: string
  venue: string | null
  event_date: string | null
  description: string | null
}

interface BoothRow {
  id: string
  blueprint_id: string
  category: BoothCategory
  position_x: number
  position_y: number
  width: number
  height: number
  price: number
  status: BoothStatus
}

function mapRowToBooth(row: BoothRow): Booth {
  return {
    id: row.id,
    blueprintId: row.blueprint_id,
    category: row.category,
    positionX: row.position_x,
    positionY: row.position_y,
    width: row.width,
    height: row.height,
    price: row.price,
    status: row.status,
  }
}

function getLoadErrorMessage(error: { message?: string } | null): string {
  const message = error?.message ?? ''

  if (/could not find the table|relation .* does not exist|schema cache/i.test(message)) {
    return 'Tabel blueprints/booths belum tersedia di Supabase. Jalankan migrasi skema terlebih dahulu.'
  }

  return message || 'Gagal memuat data event.'
}

export default function TenantEventView() {
  const { eventId } = useParams<{ eventId: string }>()
  const session = useAuthStore((state) => state.session)
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
  const [checkoutOpen, setCheckoutOpen] = useState(false)
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
    setCheckoutOpen(false)
    locallyReservedRef.current.clear()
    setBooths([])

    const loadEvent = async () => {
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
        setError('Event tidak ditemukan atau sudah tidak aktif.')
        setLoading(false)
        return
      }

      if (boothsResult.error) {
        setError(getLoadErrorMessage(boothsResult.error))
        setLoading(false)
        return
      }

      setBlueprint(blueprintResult.data as BlueprintRow)
      setBooths(((boothsResult.data ?? []) as BoothRow[]).map(mapRowToBooth))
      setLoading(false)
    }

    void loadEvent()

    return () => {
      cancelled = true
    }
  }, [eventId, reloadToken, setBooths])

  useEffect(() => {
    if (!eventId || !isSupabaseConfigured) return

    const channel = supabase
      .channel(`tenant-booths-${eventId}-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'booths',
          filter: `blueprint_id=eq.${eventId}`,
        },
        (payload) => {
          const row = payload.new as Partial<BoothRow>
          if (!row?.id) return

          const boothState = useBoothStore.getState()
          const previous = boothState.booths.find((booth) => booth.id === row.id)

          if (row.status) {
            boothState.updateBoothStatus(row.id, row.status)
          }

          if (
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
        if (status === 'CHANNEL_ERROR') {
          console.warn('Koneksi realtime booth gagal. Perubahan status mungkin tertunda.')
        }
      })

    return () => {
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

  const handleConfirmCheckout = async () => {
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
      const { data, error: updateError } = await supabase
        .from('booths')
        .update({ status: 'Reserved' })
        .eq('id', activeBooth.id)
        .eq('status', 'Available')
        .select('*')

      if (updateError) throw updateError

      if (!data || data.length === 0) {
        locallyReservedRef.current.delete(activeBooth.id)
        store.updateBoothStatus(activeBooth.id, 'Reserved')
        showToast('Booth ini baru saja diambil penyewa lain. Silakan pilih booth lain.', 'error')
        return
      }

      store.updateBoothStatus(activeBooth.id, 'Reserved')
      setReservedBoothId(activeBooth.id)
      showToast('Booth berhasil dikunci. Silakan lanjutkan ke pembayaran.', 'success')
    } catch (reserveError) {
      locallyReservedRef.current.delete(activeBooth.id)
      const message = reserveError instanceof Error ? reserveError.message : String(reserveError)
      showToast(`Gagal mengunci booth: ${message}`, 'error')
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
  const totalBooths = useBoothStore((state) => state.booths.length)

  return (
    <div className="min-h-screen bg-gray-50/60">
      <AppHeader />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          to="/event"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path
              fillRule="evenodd"
              d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z"
              clipRule="evenodd"
            />
          </svg>
          Kembali ke daftar event
        </Link>

        <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
                {blueprint?.name ?? 'Memuat event…'}
              </h1>
              <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-100">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                Sinkron real-time
              </span>
            </div>

            {blueprint ? (
              <p className="mt-1.5 text-sm text-gray-500">
                {[blueprint.venue, blueprint.event_date].filter(Boolean).join(' · ')}
              </p>
            ) : (
              <div className="mt-2 h-4 w-64 animate-pulse rounded bg-gray-200" />
            )}

            {blueprint?.description && (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500">
                {blueprint.description}
              </p>
            )}
          </div>

          {blueprint && !loading && !error && (
            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-xs text-gray-500">Ketersediaan</p>
              <p className="mt-0.5 text-lg font-semibold text-gray-900">
                {availableCount}
                <span className="text-sm font-medium text-gray-500"> / {totalBooths} booth</span>
              </p>
            </div>
          )}
        </div>

        {loading && (
          <div className="mt-8 flex min-h-[420px] items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-col items-center gap-3">
              <span
                aria-hidden="true"
                className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600"
              />
              <p className="text-sm text-gray-500">Memuat blueprint event…</p>
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
            <h2 className="mt-4 text-lg font-semibold text-gray-900">Gagal memuat event</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-500">{error}</p>
            <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setReloadToken((token) => token + 1)}
                className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                Coba lagi
              </button>
              <Link
                to="/event"
                className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
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
          confirming={reserving}
          onClose={handleCloseCheckout}
          onConfirm={handleConfirmCheckout}
        />
      )}
    </div>
  )
}
