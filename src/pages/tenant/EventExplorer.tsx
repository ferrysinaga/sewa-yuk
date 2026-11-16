import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppHeader from '../../components/layout/AppHeader'
import { EmptyPanel, ErrorPanel, LoadingPanel } from '../../components/ui/StatePanel'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { getBoothCategoryLabel } from '../../lib/boothDisplay'
import { getBlueprintErrorMessage } from '../../lib/blueprint'
import { sweepExpiredBookings } from '../../lib/bookingExpiry'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import type { BlueprintRow } from '../../types/blueprint'
import type { BoothCategory, BoothStatus } from '../../types/booth'

interface BoothSummaryRow {
  blueprint_id: string
  category: BoothCategory
  status: BoothStatus
}

interface EventSummary extends BlueprintRow {
  totalBooths: number
  availableBooths: number
  categories: BoothCategory[]
}

const categoryFilters: (BoothCategory | 'all')[] = ['all', 'F&B', 'Tech', 'Apparel']

function ArrowRight({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M4 10h11m-4-4 4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function EventExplorer() {
  useDocumentTitle('Jelajah Event')

  const [blueprints, setBlueprints] = useState<BlueprintRow[]>([])
  const [booths, setBooths] = useState<BoothSummaryRow[]>([])
  const [activeCategory, setActiveCategory] = useState<BoothCategory | 'all'>('all')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 250)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false

    if (!isSupabaseConfigured) {
      setError('Supabase belum dikonfigurasi. Isi kredensial pada file .env terlebih dahulu.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const loadEvents = async () => {
      try {
        // Pastikan booking kedaluwarsa sudah dilepas agar hitungan booth
        // tersedia pada kartu event tidak menampilkan reservasi basi.
        await sweepExpiredBookings()

        if (cancelled) return

        const blueprintResult = await supabase
          .from('blueprints')
          .select('id, name, venue, event_date, description, status, image_url, image_path')
          .eq('status', 'published')
          .order('created_at', { ascending: false })

        if (cancelled) return

        if (blueprintResult.error) {
          setError(getBlueprintErrorMessage(blueprintResult.error))
          setLoading(false)
          return
        }

        const publishedBlueprints = (blueprintResult.data ?? []) as BlueprintRow[]
        const publishedIds = publishedBlueprints.map((blueprint) => blueprint.id)

        let boothRows: BoothSummaryRow[] = []

        if (publishedIds.length > 0) {
          const boothResult = await supabase
            .from('booths')
            .select('blueprint_id, category, status')
            .in('blueprint_id', publishedIds)

          if (cancelled) return

          if (boothResult.error) {
            setError(getBlueprintErrorMessage(boothResult.error))
            setLoading(false)
            return
          }

          boothRows = (boothResult.data ?? []) as BoothSummaryRow[]
        }

        setBlueprints(publishedBlueprints)
        setBooths(boothRows)
        setLoading(false)
      } catch (loadError) {
        if (cancelled) return
        setError(getBlueprintErrorMessage(loadError))
        setLoading(false)
      }
    }

    void loadEvents()

    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const events = useMemo<EventSummary[]>(
    () =>
      blueprints.map((blueprint) => {
        const eventBooths = booths.filter((booth) => booth.blueprint_id === blueprint.id)

        return {
          ...blueprint,
          totalBooths: eventBooths.length,
          availableBooths: eventBooths.filter((booth) => booth.status === 'Available').length,
          categories: Array.from(new Set(eventBooths.map((booth) => booth.category))),
        }
      }),
    [blueprints, booths],
  )

  const searchTerm = debouncedSearch.trim().toLowerCase()

  const visibleEvents = events.filter((event) => {
    if (activeCategory !== 'all' && !event.categories.includes(activeCategory)) return false
    if (!searchTerm) return true

    const haystack =
      `${event.name} ${event.venue ?? ''} ${event.description ?? ''} ${event.categories.join(' ')}`.toLowerCase()
    return haystack.includes(searchTerm)
  })

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <AppHeader />

      <main id="main" tabIndex={-1} className="mx-auto max-w-7xl px-4 py-10 focus:outline-none sm:px-6 sm:py-12 lg:px-8">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="h-px w-6 bg-clay" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              Penjelajahan event
            </p>
          </div>
          <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-4xl">
            Temukan booth untuk bisnis Anda
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
            Pilih acara untuk melihat denah, status, dan harga booth yang tersedia.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3 border-y border-line py-3">
          <div className="w-full sm:w-auto">
            <label htmlFor="event-search" className="sr-only">
              Cari event berdasarkan nama, venue, atau deskripsi
            </label>
            <input
              id="event-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama event atau venue…"
              className="min-h-[44px] w-full rounded-[6px] border border-line bg-surface px-3 py-1.5 text-sm text-ink placeholder:text-muted focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine-soft sm:w-64"
            />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            Kategori
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {categoryFilters.map((item) => {
              const isActive = activeCategory === item

              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setActiveCategory(item)}
                  className={`inline-flex min-h-[44px] items-center rounded-[6px] border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none ${
                    isActive
                      ? 'border-pine bg-pine text-white'
                      : 'border-line bg-surface text-muted hover:border-pine hover:text-pine'
                  }`}
                >
                  {getBoothCategoryLabel(item)}
                </button>
              )
            })}
          </div>
          <p className="ml-auto text-xs tabular-nums text-muted" aria-live="polite">
            {loading ? 'Memuat acara…' : `${visibleEvents.length} dari ${events.length} acara`}
          </p>
        </div>

        {loading && (
          <LoadingPanel
            title="Memuat event yang tersedia…"
            minHeightClassName="min-h-[260px]"
          />
        )}

        {!loading && error && (
          <ErrorPanel
            title="Gagal memuat event"
            description={error}
            showIcon={false}
            onRetry={() => setReloadToken((token) => token + 1)}
          />
        )}

        {!loading && !error && events.length === 0 && (
          <EmptyPanel
            title="Belum ada event aktif"
            description="Penyelenggara belum mempublikasikan denah event. Cek kembali dalam beberapa waktu."
          />
        )}

        {!loading && !error && events.length > 0 && visibleEvents.length === 0 && (
          <EmptyPanel
            className="mt-8"
            compact
            titleAs="p"
            title={
              searchTerm
                ? `Tidak ada event yang cocok dengan "${debouncedSearch.trim()}"`
                : `Tidak ada event dengan kategori ${getBoothCategoryLabel(activeCategory)}`
            }
            description={
              searchTerm
                ? 'Coba kata kunci lain atau reset filter untuk melihat semua acara.'
                : 'Coba pilih kategori lain untuk melihat event yang tersedia.'
            }
            action={
              <button
                type="button"
                onClick={() => {
                  setActiveCategory('all')
                  setSearch('')
                }}
                className="inline-flex items-center justify-center rounded-[6px] bg-pine px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none"
              >
                Tampilkan semua acara
              </button>
            }
          />
        )}

        {!loading && !error && visibleEvents.length > 0 && (
          <div className="divide-y divide-line border-b border-line">
            {visibleEvents.map((event) => (
              <Link
                key={event.id}
                to={`/event/${event.id}`}
                className={`group grid gap-4 px-1 py-6 transition-colors hover:bg-pine-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pine sm:items-center sm:gap-6 sm:px-4 motion-reduce:transition-none ${
                  event.image_url
                    ? 'sm:grid-cols-[112px_minmax(0,1fr)_200px]'
                    : 'sm:grid-cols-[minmax(0,1fr)_200px]'
                }`}
              >
                {event.image_url && (
                  <div className="h-24 overflow-hidden rounded-[6px] border border-line bg-map sm:h-20">
                    <img
                      src={event.image_url}
                      alt={`Gambar denah ${event.name}`}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}

                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-ink sm:text-lg">{event.name}</h2>
                  <p className="mt-1 text-xs text-muted">{event.venue || 'Venue belum diatur'}</p>
                  <p className="mt-0.5 text-xs tabular-nums text-muted">
                    {event.event_date || 'Tanggal belum diatur'}
                  </p>
                  {event.description && (
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted">
                      {event.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:gap-2 sm:text-right">
                  <div>
                    <p className="text-sm font-semibold tabular-nums text-ink">
                      {event.availableBooths}{' '}
                      <span className="font-normal text-muted">dari {event.totalBooths}</span>
                    </p>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                      booth tersedia
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-pine transition-colors group-hover:text-pine-dark">
                    Lihat peta
                    <ArrowRight />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        <p className="mt-6 max-w-2xl text-xs leading-relaxed text-muted">
          Status booth pada denah acara diperbarui otomatis saat ada perubahan pemesanan.
        </p>
      </main>
    </div>
  )
}
