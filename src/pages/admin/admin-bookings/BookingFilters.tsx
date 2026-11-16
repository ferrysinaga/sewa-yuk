import { BOOKING_STATUS_LABEL, BOOKING_STATUS_OPTIONS } from '../../../types/booking'
import type { BookingStatus } from '../../../types/booking'
import type { AdminBookingsState } from './useAdminBookings'

export default function BookingFilters({ state }: { state: AdminBookingsState }) {
  return (
    <div className="grid gap-2 border-b border-line px-5 py-3 sm:grid-cols-3">
      <div>
        <label htmlFor="booking-search" className="sr-only">
          Cari pemesanan
        </label>
        <input
          id="booking-search"
          type="search"
          value={state.search}
          onChange={(event) => state.handleSearchChange(event.target.value)}
          placeholder="Cari kode, tenant, event…"
          className="w-full rounded-[8px] border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine-soft"
        />
      </div>
      <div>
        <label htmlFor="booking-event-filter" className="sr-only">
          Filter event
        </label>
        <select
          id="booking-event-filter"
          value={state.eventFilter}
          onChange={(event) => state.handleEventFilterChange(event.target.value)}
          className="w-full rounded-[8px] border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine-soft"
        >
          <option value="all">Semua event</option>
          {state.blueprints.map((blueprint) => (
            <option key={blueprint.id} value={blueprint.id}>
              {blueprint.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="booking-status-filter" className="sr-only">
          Filter status
        </label>
        <select
          id="booking-status-filter"
          value={state.statusFilter}
          onChange={(event) =>
            state.handleStatusFilterChange(event.target.value as BookingStatus | 'all')
          }
          className="w-full rounded-[8px] border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine-soft"
        >
          <option value="all">Semua status</option>
          {BOOKING_STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {BOOKING_STATUS_LABEL[status]}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
