import SyncStatusBadge from '../../../components/ui/SyncStatusBadge'
import type { AdminBookingsState } from './useAdminBookings'

export default function BookingListToolbar({ state }: { state: AdminBookingsState }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
      <div>
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-base font-semibold text-ink">Daftar pemesanan</h2>
          <SyncStatusBadge
            status={state.feed.status}
            lastUpdatedAt={state.lastUpdatedAt}
            onRefresh={() => void state.handleRefresh()}
            refreshing={state.refreshing}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {state.filtersActive && (
          <button
            type="button"
            onClick={state.handleResetFilters}
            className="inline-flex items-center gap-1.5 rounded-card-sm border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2"
          >
            Reset filter
          </button>
        )}
        <button
          type="button"
          onClick={() => void state.handleRefresh()}
          disabled={state.refreshing}
          className="inline-flex items-center gap-1.5 rounded-card-sm border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state.refreshing ? 'Memperbarui…' : 'Perbarui status'}
        </button>
      </div>
    </div>
  )
}
