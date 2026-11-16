import { BOOKING_STATUS_LABEL } from '../../../types/booking'
import { statusFilters } from './useTenantBookings'
import type { TenantBookingsState } from './useTenantBookings'

export default function BookingStatusFilters({ state }: { state: TenantBookingsState }) {
  const { bookings, statusFilter, setStatusFilter } = state

  return (
    <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Filter status pesanan">
      {statusFilters.map((status) => {
        const isActive = statusFilter === status
        const count =
          status === 'all'
            ? bookings.length
            : bookings.filter((booking) => booking.status === status).length

        return (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            aria-pressed={isActive}
            className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 ${
              isActive
                ? 'bg-pine text-white ring-pine'
                : 'bg-surface text-muted ring-line hover:bg-canvas'
            }`}
          >
            {status === 'all' ? 'Semua' : BOOKING_STATUS_LABEL[status]}
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                isActive ? 'bg-pine-dark text-white' : 'bg-unavailable text-muted'
              }`}
            >
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
