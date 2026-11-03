import { Link } from 'react-router-dom'
import AppHeader from '../../components/layout/AppHeader'
import { useAuthStore } from '../../store/useAuthStore'

const stats = [
  { label: 'Event aktif', value: '3', detail: '+1 bulan ini' },
  { label: 'Booth terjual', value: '182', detail: 'dari 240 unit' },
  { label: 'Pendapatan', value: 'Rp 1,24 M', detail: '90 hari terakhir' },
  { label: 'Okupansi', value: '76%', detail: 'rata-rata hall' },
]

export default function AdminDashboard() {
  const user = useAuthStore((state) => state.user)

  const displayName = (user?.user_metadata?.full_name as string | undefined) || user?.email || 'Penyelenggara'

  return (
    <div className="min-h-screen bg-gray-50/60">
      <AppHeader />

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-gray-500">Dashboard Penyelenggara</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
              Selamat datang, {displayName}
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Kelola blueprint, pantau okupansi, dan kunci booth secara real-time.
            </p>
          </div>
          <Link
            to="/admin/blueprint"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
            </svg>
            Buat Denah Baru
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium text-gray-500">{stat.label}</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">{stat.value}</p>
              <p className="mt-1 text-xs text-gray-500">{stat.detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Blueprint aktif</h2>
                <p className="text-xs text-gray-500">Hall A — Pameran Teknologi Nusantara 2026</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-100">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                Live
              </span>
            </div>

            <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50/70 p-4">
              <svg viewBox="0 0 520 240" aria-label="Pratinjau blueprint hall" className="h-auto w-full">
                <rect x="0" y="0" width="520" height="240" rx="12" fill="white" stroke="#e5e7eb" />
                <rect x="20" y="20" width="110" height="60" rx="8" fill="white" stroke="#d1d5db" />
                <rect x="20" y="92" width="110" height="60" rx="8" fill="#f3f4f6" stroke="#e5e7eb" />
                <rect x="20" y="164" width="110" height="56" rx="8" fill="white" stroke="#d1d5db" />
                <rect x="150" y="20" width="150" height="200" rx="8" fill="white" stroke="#e5e7eb" strokeDasharray="4 4" />
                <rect x="320" y="20" width="180" height="92" rx="8" fill="#2563eb" />
                <rect x="320" y="124" width="180" height="96" rx="8" fill="#f3f4f6" stroke="#e5e7eb" />
                <text x="32" y="44" fill="#111827" fontSize="10" fontWeight="600">A-01</text>
                <text x="32" y="58" fill="#6b7280" fontSize="9">Tech</text>
                <text x="332" y="44" fill="#ffffff" fontSize="10" fontWeight="600">B-02</text>
                <text x="332" y="58" fill="#bfdbfe" fontSize="9">Terpilih</text>
                <text x="215" y="124" textAnchor="middle" fill="#9ca3af" fontSize="10">Zona komunitas</text>
              </svg>
            </div>

            <p className="mt-4 text-sm text-gray-500">
              Gunakan kanvas drag-and-drop dengan snap-to-grid untuk mengatur ulang posisi booth.
            </p>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-base font-semibold text-gray-900">Aktivitas terbaru</h2>
            <ul className="mt-4 space-y-4">
              {[
                { title: 'Booth B-02 dikunci', detail: 'Tenant PT Karya Digital · 2 menit lalu' },
                { title: 'Booth A-03 dibayar', detail: 'Tenant Kopi Nusantara · 18 menit lalu' },
                { title: 'Denah Hall B dipublikasi', detail: 'oleh Anda · 1 jam lalu' },
              ].map((item) => (
                <li key={item.title} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.title}</p>
                    <p className="text-xs text-gray-500">{item.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </div>
  )
}
