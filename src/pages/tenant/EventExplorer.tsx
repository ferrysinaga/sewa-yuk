import { Link } from 'react-router-dom'
import AppHeader from '../../components/layout/AppHeader'

const events = [
  {
    id: 'hall-a',
    title: 'Pameran Teknologi Nusantara 2026',
    venue: 'Jakarta Convention Center · Hall A',
    date: '12 — 15 Maret 2026',
    category: 'Teknologi',
    available: 42,
    total: 120,
  },
  {
    id: 'hall-b',
    title: 'Festival Kuliner Merdeka',
    venue: 'Grand City Convention · Hall B',
    date: '2 — 5 April 2026',
    category: 'F&B',
    available: 18,
    total: 90,
  },
  {
    id: 'hall-5',
    title: 'Indonesia Fashion Week',
    venue: 'ICE BSD · Hall 5',
    date: '21 — 26 April 2026',
    category: 'Pakaian',
    available: 31,
    total: 140,
  },
]

export default function EventExplorer() {
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
            Jelajahi acara yang sedang membuka pendaftaran penyewaan ruang, lalu bandingkan posisi strategis
            langsung di atas kanvas.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {['Semua', 'F&B', 'Teknologi', 'Pakaian'].map((tag, index) => (
            <span
              key={tag}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-medium ring-1 ring-inset ${
                index === 0 ? 'bg-blue-600 text-white ring-blue-600' : 'bg-white text-gray-600 ring-gray-200'
              }`}
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => (
            <article
              key={event.title}
              className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-md transition-shadow hover:shadow-lg"
            >
              <div className="flex h-32 items-center justify-center border-b border-gray-200 bg-gray-50/70">
                <svg viewBox="0 0 320 128" aria-hidden="true" className="h-full w-full">
                  <rect x="16" y="16" width="70" height="42" rx="6" fill="white" stroke="#d1d5db" />
                  <rect x="96" y="16" width="80" height="42" rx="6" fill="white" stroke="#d1d5db" />
                  <rect x="186" y="16" width="118" height="42" rx="6" fill="#2563eb" />
                  <rect x="16" y="68" width="140" height="44" rx="6" fill="#f3f4f6" stroke="#e5e7eb" />
                  <rect x="166" y="68" width="138" height="44" rx="6" fill="white" stroke="#d1d5db" />
                  <text x="28" y="38" fill="#111827" fontSize="8" fontWeight="600">A-01</text>
                  <text x="198" y="38" fill="#ffffff" fontSize="8" fontWeight="600">B-01</text>
                </svg>
              </div>

              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-200">
                    {event.category}
                  </span>
                  <span className="text-xs font-medium text-gray-500">{event.available} booth tersedia</span>
                </div>

                <h2 className="mt-3 text-base font-semibold text-gray-900">{event.title}</h2>
                <p className="mt-1 text-xs text-gray-500">{event.venue}</p>
                <p className="mt-1 text-xs text-gray-500">{event.date}</p>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Okupansi</span>
                    <span>
                      {event.total - event.available}/{event.total}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-blue-600"
                      style={{ width: `${((event.total - event.available) / event.total) * 100}%` }}
                    />
                  </div>
                </div>

                <Link
                  to={`/event/${event.id}`}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                >
                  Lihat Peta Booth
                </Link>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  )
}
