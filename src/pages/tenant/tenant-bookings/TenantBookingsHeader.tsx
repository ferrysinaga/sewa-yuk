import { Link } from 'react-router-dom'
import SyncStatusBadge from '../../../components/ui/SyncStatusBadge'
import type { TenantBookingsState } from './useTenantBookings'

export default function TenantBookingsHeader({ state }: { state: TenantBookingsState }) {
  const { feed, lastUpdatedAt, handleRefresh, refreshing, loading } = state

  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="h-px w-6 bg-clay" />
          <p className="text-compact font-semibold uppercase tracking-[0.18em] text-muted">
            Riwayat penyewaan
          </p>
        </div>
        <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-4xl">
          Pesanan Saya
        </h1>
        <p className="mt-2 text-sm text-muted">
          Pantau status pemesanan booth dan selesaikan pembayaran sebelum batas waktu.
        </p>
        <div className="mt-3">
          <SyncStatusBadge
            status={feed.status}
            lastUpdatedAt={lastUpdatedAt}
            onRefresh={() => void handleRefresh()}
            refreshing={refreshing}
          />
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={refreshing || loading}
          className="inline-flex items-center justify-center gap-2 rounded-card-sm border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {refreshing ? 'Memperbarui…' : 'Perbarui status'}
        </button>
        <Link
          to="/event"
          className="inline-flex items-center justify-center gap-2 rounded-card-sm bg-pine px-5 py-2.5 text-sm font-semibold text-on-accent transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2"
        >
          Jelajahi Event
        </Link>
      </div>
    </div>
  )
}
