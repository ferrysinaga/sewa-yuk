import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppHeader from '../../components/layout/AppHeader'
import { getBlueprintErrorMessage } from '../../lib/blueprint'
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

const categoryLabel: Record<BoothCategory | 'all', string> = {
  all: 'Semua',
  'F&B': 'F&B',
  Tech: 'Teknologi',
  Apparel: 'Pakaian',
}

const categoryFilters: (BoothCategory | 'all')[] = ['all', 'F&B', 'Tech', 'Apparel']

export default function EventExplorer() {
  const [blueprints, setBlueprints] = useState<BlueprintRow[]>([])
  const [booths, setBooths] = useState<BoothSummaryRow[]>([])
  const [activeCategory, setActiveCategory] = useState<BoothCategory | 'all'>('all')
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
      const [blueprintResult, boothResult] = await Promise.all([
        supabase
          .from('blueprints')
          .select('id, name, venue, event_date, description, status, image_url, image_path')
          .eq('status', 'published')
          .order('created_at', { ascending: false }),
        supabase.from('booths').select('blueprint_id, category, status'),
      ])

      if (cancelled) return

      if (blueprintResult.error) {
        setError(getBlueprintErrorMessage(blueprintResult.error))
        setLoading(false)
        return
      }

      if (boothResult.error) {
        setError(getBlueprintErrorMessage(boothResult.error))
        setLoading(false)
        return
      }

      setBlueprints((blueprintResult.data ?? []) as BlueprintRow[])
      setBooths((boothResult.data ?? []) as BoothSummaryRow[])
      setLoading(false)
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
        const categories = Array.from(new Set(eventBooths.map((booth) => booth.category)))

        return {
          ...blueprint,
          totalBooths: eventBooths.length,
          availableBooths: eventBooths.filter((booth) => booth.status === 'Available').length,
          categories,
        }
      }),
    [blueprints, booths],
  )

  const visibleEvents =
    activeCategory === 'all'
      ? events
      : events.filter((event) => event.categories.includes(activeCategory))

  return (
    <div className="min-h-screen bg-gray-50/60">
      <AppHeader />

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-gray-500">Penjelajahan Event</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
            Temukan booth untuk bisnis Anda
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">
            Jelajahi acara yang sedang membuka pendaftaran penyewaan ruang, lalu bandingkan posisi
            strategis langsung di atas kanvas.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {categoryFilters.map((category) => {
            const isActive = activeCategory === category

            return (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                aria-pressed={isActive}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
                  isActive
                    ? 'bg-blue-600 text-white ring-blue-600'
                    : 'bg-white text-gray-600 ring-gray-200 hover:bg-gray-50'
                }`}
              >
                {categoryLabel[category]}
              </button>
            )
          })}
        </div>

        {loading && (
          <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="h-80 animate-pulse rounded-2xl border border-gray-200 bg-white shadow-md"
              />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008ZM10.34 3.94 2.7 17.54A1.5 1.5 0 0 0 4 19.75h16a1.5 1.5 0 0 0 1.3-2.21L13.66 3.94a1.5 1.5 0 0 0-2.62 0Z" />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-gray-900">Gagal memuat event</h2>
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

        {!loading && !error && events.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-gray-900">Belum ada event aktif</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-gray-500">
              Penyelenggara belum mempublikasikan denah event. Cek kembali dalam beberapa waktu.
            </p>
          </div>
        )}

        {!loading && !error && events.length > 0 && visibleEvents.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center shadow-sm">
            <h2 className="text-base font-semibold text-gray-900">
              Tidak ada event dengan kategori {categoryLabel[activeCategory]}
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-gray-500">
              Coba pilih kategori lain untuk melihat event yang tersedia.
            </p>
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className="mt-5 inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              Lihat semua kategori
            </button>
          </div>
        )}

        {!loading && !error && visibleEvents.length > 0 && (
          <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {visibleEvents.map((event) => {
              const sold = event.totalBooths - event.availableBooths
              const occupancy =
                event.totalBooths > 0 ? Math.round((sold / event.totalBooths) * 100) : 0
              const categoryText =
                event.categories.length === 0
                  ? 'Belum ada booth'
                  : event.categories.length === 1
                    ? categoryLabel[event.categories[0]]
                    : `${event.categories.length} kategori`

              return (
                <article
                  key={event.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-md transition-shadow hover:shadow-lg"
                >
                  <div className="relative h-40 overflow-hidden border-b border-gray-200 bg-gray-50/70">
                    {event.image_url ? (
                      <>
                        <img
                          src={event.image_url}
                          alt={`Gambar denah ${event.name}`}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        />
                        <span className="absolute left-3 top-3 rounded-full bg-gray-900/70 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur">
                          Gambar denah
                        </span>
                      </>
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <svg viewBox="0 0 320 128" aria-hidden="true" className="h-full w-full">
                          <rect x="16" y="16" width="70" height="42" rx="6" fill="white" stroke="#d1d5db" />
                          <rect x="96" y="16" width="80" height="42" rx="6" fill="white" stroke="#d1d5db" />
                          <rect x="186" y="16" width="118" height="42" rx="6" fill="#2563eb" />
                          <rect x="16" y="68" width="140" height="44" rx="6" fill="#f3f4f6" stroke="#e5e7eb" />
                          <rect x="166" y="68" width="138" height="44" rx="6" fill="white" stroke="#d1d5db" />
                          <text x="28" y="38" fill="#111827" fontSize="8" fontWeight="600">
                            A-01
                          </text>
                          <text x="198" y="38" fill="#ffffff" fontSize="8" fontWeight="600">
                            B-01
                          </text>
                        </svg>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-200">
                        {categoryText}
                      </span>
                      <span className="text-xs font-medium text-gray-500">
                        {event.availableBooths} booth tersedia
                      </span>
                    </div>

                    <h2 className="mt-3 text-base font-semibold text-gray-900">{event.name}</h2>
                    <p className="mt-1 text-xs text-gray-500">
                      {event.venue || 'Venue belum diatur'}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {event.event_date || 'Tanggal belum diatur'}
                    </p>

                    {event.description && (
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-gray-500">
                        {event.description}
                      </p>
                    )}

                    <div className="mt-auto pt-4">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>Okupansi</span>
                        <span>
                          {sold}/{event.totalBooths}
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-blue-600"
                          style={{ width: `${occupancy}%` }}
                        />
                      </div>

                      <Link
                        to={`/event/${event.id}`}
                        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                      >
                        Lihat Peta Booth
                      </Link>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
