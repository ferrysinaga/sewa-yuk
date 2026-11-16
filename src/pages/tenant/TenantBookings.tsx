import AppHeader from '../../components/layout/AppHeader'
import { ErrorPanel, LoadingPanel } from '../../components/ui/StatePanel'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import BookingEmptyState from './tenant-bookings/BookingEmptyState'
import BookingStatusFilters from './tenant-bookings/BookingStatusFilters'
import TenantBookingCard from './tenant-bookings/TenantBookingCard'
import TenantBookingsHeader from './tenant-bookings/TenantBookingsHeader'
import { useTenantBookings } from './tenant-bookings/useTenantBookings'

export default function TenantBookings() {
  const state = useTenantBookings()
  useDocumentTitle('Pesanan Saya')

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader />

      <main id="main" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-10 focus:outline-none sm:px-6 lg:px-8">
        <TenantBookingsHeader state={state} />

        {state.loading && (
          <LoadingPanel
            className="mt-8"
            title="Memuat pesanan…"
            titleClassName="text-sm text-muted"
          />
        )}

        {!state.loading && state.error && (
          <ErrorPanel
            className="mt-8"
            title="Gagal memuat pesanan"
            description={state.error}
            onRetry={state.retry}
          />
        )}

        {!state.loading && !state.error && (
          <>
            <BookingStatusFilters state={state} />

            {state.visibleBookings.length === 0 ? (
              <BookingEmptyState hasBookings={state.bookings.length > 0} />
            ) : (
              <ul className="mt-6 space-y-4">
                {state.visibleBookings.map((booking) => (
                  <TenantBookingCard key={booking.id} booking={booking} state={state} />
                ))}
              </ul>
            )}

            {state.bookings.length > 0 && (
              <p className="mt-6 text-center text-[11px] text-muted">
                Pembayaran pada aplikasi ini masih berupa simulasi. Organizer memverifikasi pesanan
                secara manual.
              </p>
            )}
          </>
        )}
      </main>
    </div>
  )
}
