import { Link } from 'react-router-dom'
import type { AdminDashboardState } from './useAdminDashboard'

export default function DashboardHeader({ dashboard }: { dashboard: AdminDashboardState }) {
  const { activeEvent, displayName } = dashboard

  return (
    <div className="flex flex-col justify-between gap-6 border-b border-line pb-6 sm:flex-row sm:items-end">
      <div className="max-w-2xl">
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="h-px w-6 bg-clay" />
          <p className="text-compact font-semibold uppercase tracking-[0.18em] text-muted">
            Dashboard penyelenggara
          </p>
        </div>
        <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-4xl">
          {activeEvent?.name ?? 'Inventaris semua event'}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {activeEvent
            ? [activeEvent.venue, activeEvent.event_date].filter(Boolean).join(' · ') ||
              'Venue dan tanggal belum diatur.'
            : `Selamat datang, ${displayName}. Pantau okupansi dan kelola status booth dari satu tempat.`}
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          to="/event"
          className="inline-flex items-center justify-center rounded-control border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-pine-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none"
        >
          Lihat halaman publik
        </Link>
        <Link
          to="/admin/bookings"
          className="inline-flex items-center justify-center gap-2 rounded-control border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-pine-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none"
        >
          Pemesanan
        </Link>
        <Link
          to="/admin/blueprint"
          className="inline-flex items-center justify-center gap-2 rounded-control bg-pine px-4 py-2.5 text-sm font-semibold text-on-accent transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
            <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
          </svg>
          Kelola Denah
        </Link>
      </div>
    </div>
  )
}
