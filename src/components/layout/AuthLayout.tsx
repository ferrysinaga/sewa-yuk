import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-gray-900 p-10 lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -right-20 -top-24 h-80 w-80 rounded-full bg-blue-600/30 blur-3xl" />
          <div className="absolute -bottom-32 left-0 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl" />
          <svg viewBox="0 0 600 600" className="absolute inset-0 h-full w-full text-white/[0.04]" fill="none" stroke="currentColor" strokeWidth="1">
            <path d="M0 150h600M0 300h600M0 450h600M150 0v600M300 0v600M450 0v600" />
          </svg>
        </div>

        <Link
          to="/"
          className="relative flex w-fit items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 9V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3M4 9h16M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9M9 9v11M15 9v11" />
            </svg>
          </span>
          <span className="text-base font-semibold tracking-tight text-white">sewa-yuk</span>
        </Link>

        <div className="relative max-w-md py-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-gray-200">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
            Platform booking booth spasial
          </span>
          <h2 className="mt-5 text-3xl font-semibold leading-tight tracking-tight text-white xl:text-4xl">
            Satu kanvas untuk seluruh siklus sewa booth.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-gray-300">
            Masuk untuk memantau ketersediaan real-time, mengunci posisi strategis, dan mengelola event tanpa
            risiko bentrokan jadwal.
          </p>

          <ul className="mt-8 space-y-4 text-sm text-gray-200">
            {[
              'Peta blueprint interaktif dengan status live',
              'Anti double-booking dengan penguncian otomatis',
              'Harga dan spesifikasi transparan di setiap booth',
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-blue-300">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                    <path
                      fillRule="evenodd"
                      d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.5 7.5a1 1 0 0 1-1.42 0l-3.5-3.5a1 1 0 1 1 1.414-1.414l2.793 2.793 6.793-6.793a1 1 0 0 1 1.414 0Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur">
            <svg viewBox="0 0 400 150" aria-hidden="true" className="h-auto w-full">
              <rect x="0.5" y="0.5" width="399" height="149" rx="12" fill="none" stroke="rgba(255,255,255,0.12)" />
              <rect x="20" y="20" width="100" height="50" rx="8" fill="rgba(255,255,255,0.9)" />
              <rect x="132" y="20" width="100" height="50" rx="8" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.25)" />
              <rect x="244" y="20" width="136" height="110" rx="8" fill="rgba(37,99,235,0.85)" />
              <rect x="20" y="82" width="212" height="48" rx="8" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.25)" />
              <text x="32" y="42" fill="#111827" fontSize="9" fontWeight="600">A-01</text>
              <text x="32" y="56" fill="#6b7280" fontSize="8">Tersedia</text>
              <text x="256" y="48" fill="#ffffff" fontSize="9" fontWeight="600">B-02</text>
              <text x="256" y="62" fill="#bfdbfe" fontSize="8">Dipilih</text>
            </svg>
          </div>

          <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-white/10 pt-6">
            {[
              { value: '128+', label: 'Event aktif' },
              { value: '4.2K', label: 'Booth tersewa' },
              { value: '0', label: 'Double-booking' },
            ].map((stat) => (
              <div key={stat.label}>
                <dt className="text-xs text-gray-400">{stat.label}</dt>
                <dd className="mt-1 text-xl font-semibold text-white">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </aside>

      <main className="flex min-h-screen flex-col">
        <div className="flex items-center justify-between px-4 py-5 sm:px-6 lg:hidden">
          <Link
            to="/"
            className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 9V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3M4 9h16M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9M9 9v11M15 9v11" />
              </svg>
            </span>
            <span className="text-base font-semibold tracking-tight text-gray-900">sewa-yuk</span>
          </Link>
          <Link
            to="/"
            className="text-sm font-medium text-gray-500 transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            Beranda
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
          <div className="w-full max-w-md">{children}</div>
        </div>

        <footer className="px-4 pb-6 text-center text-xs text-gray-400 sm:px-6">
          © 2026 sewa-yuk. Semua hak dilindungi.
        </footer>
      </main>
    </div>
  )
}
