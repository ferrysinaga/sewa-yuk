import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppHeader from '../../components/layout/AppHeader'

type EventCategory = 'Teknologi' | 'F&B' | 'Pakaian'

interface EventItem {
  id: string
  title: string
  venue: string
  day: string
  month: string
  date: string
  category: EventCategory
  available: number
  total: number
}

const events: EventItem[] = [
  {
    id: 'hall-a',
    title: 'Pameran Teknologi Nusantara 2026',
    venue: 'Jakarta Convention Center · Hall A',
    day: '12–15',
    month: 'Mar 2026',
    date: '12 — 15 Maret 2026',
    category: 'Teknologi',
    available: 42,
    total: 120,
  },
  {
    id: 'hall-b',
    title: 'Festival Kuliner Merdeka',
    venue: 'Grand City Convention · Hall B',
    day: '2–5',
    month: 'Apr 2026',
    date: '2 — 5 April 2026',
    category: 'F&B',
    available: 18,
    total: 90,
  },
  {
    id: 'hall-5',
    title: 'Indonesia Fashion Week',
    venue: 'ICE BSD · Hall 5',
    day: '21–26',
    month: 'Apr 2026',
    date: '21 — 26 April 2026',
    category: 'Pakaian',
    available: 31,
    total: 140,
  },
]

const categoryFilters: Array<EventCategory | 'all'> = ['all', 'F&B', 'Teknologi', 'Pakaian']

const filterLabel: Record<EventCategory | 'all', string> = {
  all: 'Semua',
  'F&B': 'F&B',
  Teknologi: 'Teknologi',
  Pakaian: 'Pakaian',
}

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
  const [category, setCategory] = useState<EventCategory | 'all'>('all')

  const visibleEvents = useMemo(
    () => (category === 'all' ? events : events.filter((event) => event.category === category)),
    [category],
  )

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <AppHeader />

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
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
              Jelajahi acara yang sedang membuka pendaftaran penyewaan ruang, lalu bandingkan posisi
              strategis langsung di atas kanvas.
            </p>
          </div>

          <div className="border-t border-line pt-4 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0 sm:text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Acara tersedia
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
              {events.length}
              <span className="ml-1 text-sm font-medium text-muted">event</span>
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3 border-y border-line py-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            Kategori
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {categoryFilters.map((item) => {
              const isActive = category === item

              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setCategory(item)}
                  className={`inline-flex min-h-[38px] items-center rounded-[6px] border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none ${
                    isActive
                      ? 'border-pine bg-pine text-white'
                      : 'border-line bg-surface text-muted hover:border-pine hover:text-pine'
                  }`}
                >
                  {filterLabel[item]}
                </button>
              )
            })}
          </div>
          <p className="ml-auto text-xs tabular-nums text-muted">
            {visibleEvents.length} dari {events.length} acara
          </p>
        </div>

        {visibleEvents.length > 0 ? (
          <div className="divide-y divide-line border-b border-line">
            {visibleEvents.map((event) => {
              const occupied = event.total - event.available
              const occupancy = Math.round((occupied / event.total) * 100)

              return (
                <Link
                  key={event.id}
                  to={`/event/${event.id}`}
                  className="group grid gap-4 px-1 py-6 transition-colors hover:bg-pine-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pine sm:grid-cols-[104px_minmax(0,1fr)_200px] sm:items-center sm:gap-6 sm:px-4 motion-reduce:transition-none"
                >
                  <div className="flex items-baseline gap-2 sm:block">
                    <p className="text-2xl font-semibold tabular-nums tracking-tight text-ink">
                      {event.day}
                    </p>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                      {event.month}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-ink sm:text-lg">{event.title}</h2>
                      <span className="rounded-[4px] border border-line bg-surface px-1.5 py-0.5 text-[10px] font-medium text-muted">
                        {event.category}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted">{event.venue}</p>
                    <p className="mt-0.5 text-xs tabular-nums text-muted">{event.date}</p>

                    <div className="mt-3 flex items-center gap-3">
                      <div className="h-1.5 w-full max-w-[220px] overflow-hidden rounded-[2px] bg-unavailable">
                        <div
                          className="h-full rounded-[2px] bg-pine"
                          style={{ width: `${occupancy}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-[11px] tabular-nums text-muted">
                        {occupancy}% terisi
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:gap-2 sm:text-right">
                    <div>
                      <p className="text-sm font-semibold tabular-nums text-ink">
                        {event.available}{' '}
                        <span className="font-normal text-muted">dari {event.total}</span>
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
              )
            })}
          </div>
        ) : (
          <div className="mt-8 rounded-[10px] border border-dashed border-line bg-surface px-6 py-12 text-center">
            <p className="text-sm font-semibold text-ink">Belum ada acara pada kategori ini</p>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted">
              Coba pilih kategori lain atau tampilkan semua acara untuk melihat denah yang tersedia.
            </p>
            <button
              type="button"
              onClick={() => setCategory('all')}
              className="mt-4 inline-flex items-center justify-center rounded-[6px] bg-pine px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none"
            >
              Tampilkan semua acara
            </button>
          </div>
        )}

        <p className="mt-6 max-w-2xl text-xs leading-relaxed text-muted">
          Setiap acara memakai denah yang sama dengan yang dikelola penyelenggara. Status booth
          diperbarui otomatis, termasuk saat penyewa lain sedang mengunci posisi.
        </p>
      </main>
    </div>
  )
}
