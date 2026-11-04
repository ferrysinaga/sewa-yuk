import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

function BrandMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-[7px] bg-pine text-white ${className}`}>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
        <rect x="4" y="4" width="7" height="6" rx="1" stroke="currentColor" strokeWidth="1.6" />
        <rect x="13" y="4" width="7" height="6" rx="1" stroke="currentColor" strokeWidth="1.6" />
        <rect x="4" y="12" width="7" height="8" rx="1" stroke="currentColor" strokeWidth="1.6" />
        <rect x="13" y="12" width="7" height="8" rx="1" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    </span>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pine">
      <path
        d="m3.5 8.5 3 3 6-7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const benefits = [
  'Peta blueprint interaktif dengan status live',
  'Anti double-booking dengan penguncian otomatis',
  'Harga dan spesifikasi transparan di setiap booth',
]

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas text-ink lg:grid lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden border-r border-line bg-canvas p-10 lg:flex lg:flex-col lg:justify-between xl:p-14">
        <Link
          to="/"
          className="flex w-fit items-center gap-2.5 rounded-[6px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        >
          <BrandMark />
          <span className="leading-tight">
            <span className="block text-sm font-semibold tracking-tight text-ink">sewa-yuk</span>
            <span className="block text-[10px] uppercase tracking-[0.14em] text-muted">
              Peta booth pameran
            </span>
          </span>
        </Link>

        <div className="max-w-md py-10">
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="h-1.5 w-1.5 bg-clay" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              Platform booking booth spasial
            </p>
          </div>
          <h2 className="mt-5 text-3xl font-semibold leading-[1.1] tracking-[-0.02em] text-ink xl:text-4xl">
            Satu denah untuk seluruh siklus sewa booth.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Masuk untuk memantau ketersediaan real-time, mengunci posisi strategis, dan mengelola
            event tanpa risiko bentrokan jadwal.
          </p>

          <ul className="mt-8 space-y-3 border-t border-line pt-6 text-sm text-ink">
            {benefits.map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <CheckIcon />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="rounded-[10px] border border-line bg-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                Pratinjau denah
              </p>
              <span className="text-[10px] tabular-nums text-muted">Hall A</span>
            </div>
            <svg viewBox="0 0 400 150" role="img" aria-label="Pratinjau denah booth" className="mt-3 h-auto w-full">
              <rect x="0.5" y="0.5" width="399" height="149" rx="7" fill="var(--color-map)" stroke="var(--color-line)" />
              <rect x="20" y="20" width="100" height="50" rx="6" fill="var(--color-surface)" stroke="var(--color-pine)" strokeWidth="1.4" />
              <rect x="132" y="20" width="100" height="50" rx="6" fill="var(--color-unavailable)" stroke="var(--color-muted)" strokeDasharray="4 3" />
              <rect x="244" y="20" width="136" height="110" rx="6" fill="var(--color-pine)" stroke="var(--color-pine-dark)" strokeWidth="1.6" />
              <rect x="20" y="82" width="212" height="48" rx="6" fill="var(--color-unavailable-deep)" stroke="var(--color-muted)" />
              <text x="32" y="42" fill="var(--color-ink)" fontSize="9" fontWeight="600">A-01</text>
              <text x="32" y="56" fill="var(--color-muted)" fontSize="8">Tersedia</text>
              <text x="256" y="48" fill="#ffffff" fontSize="9" fontWeight="600">B-02</text>
              <text x="256" y="62" fill="var(--color-pine-soft)" fontSize="8">Dipilih</text>
              <text x="32" y="104" fill="var(--color-ink)" fontSize="9" fontWeight="600">A-04</text>
              <text x="32" y="118" fill="var(--color-muted)" fontSize="8">Terisi</text>
            </svg>
          </div>

          <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-line pt-6">
            {[
              { value: '128+', label: 'Event aktif' },
              { value: '4.2K', label: 'Booth tersewa' },
              { value: '0', label: 'Double-booking' },
            ].map((stat) => (
              <div key={stat.label}>
                <dt className="text-[11px] text-muted">{stat.label}</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums text-ink">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </aside>

      <main className="flex min-h-screen flex-col bg-surface">
        <div className="flex items-center justify-between border-b border-line px-4 py-4 sm:px-6 lg:hidden">
          <Link
            to="/"
            className="flex items-center gap-2.5 rounded-[6px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            <BrandMark />
            <span className="text-base font-semibold tracking-tight text-ink">sewa-yuk</span>
          </Link>
          <Link
            to="/"
            className="rounded-[6px] text-sm font-medium text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none"
          >
            Beranda
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
          <div className="w-full max-w-md">{children}</div>
        </div>

        <footer className="border-t border-line px-4 py-5 text-center text-xs text-muted sm:px-6">
          © 2026 sewa-yuk. Semua hak dilindungi.
        </footer>
      </main>
    </div>
  )
}
