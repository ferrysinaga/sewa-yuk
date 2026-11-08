import { Link } from 'react-router-dom'
import CheckoutModal from '../../components/checkout/CheckoutModal'
import AppHeader from '../../components/layout/AppHeader'
import InteractiveMap from '../../components/map/InteractiveMap'
import TenantSidebar from '../../components/map/TenantSidebar'
import { ErrorPanel, LoadingPanel } from '../../components/ui/StatePanel'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import TenantEventHeader from './tenant-event-view/TenantEventHeader'
import { useTenantEventView } from './tenant-event-view/useTenantEventView'

export default function TenantEventView() {
  const state = useTenantEventView()
  useDocumentTitle(state.blueprint?.name ?? 'Detail Event')

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <AppHeader />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <TenantEventHeader state={state} />

        {state.loading && (
          <LoadingPanel
            title="Memuat denah event…"
            description="Mengambil data blueprint dan booth dari Supabase."
            minHeightClassName="min-h-[420px]"
          />
        )}

        {!state.loading && state.error && (
          <ErrorPanel
            title="Gagal memuat event"
            description={state.error}
            iconTone="clay"
            onRetry={state.retry}
            secondaryAction={
              <Link
                to="/event"
                className="inline-flex items-center justify-center rounded-[6px] border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none"
              >
                Kembali ke daftar event
              </Link>
            }
          />
        )}

        {!state.loading && !state.error && (
          <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <InteractiveMap activeCategory={state.activeCategory} />
            <TenantSidebar
              activeCategory={state.activeCategory}
              onCategoryChange={state.setActiveCategory}
              onReserve={state.handleOpenCheckout}
              reserving={state.reserving}
              reservedBoothId={state.reservedBoothId}
            />
          </div>
        )}
      </main>

      {state.checkoutOpen && state.activeBooth && (
        <CheckoutModal
          booth={state.activeBooth}
          eventName={state.blueprint?.name}
          reserved={state.reservedBoothId === state.activeBooth.id}
          bookingCode={state.reservedBooking?.booking_code ?? null}
          confirming={state.reserving}
          onClose={state.handleCloseCheckout}
          onConfirm={state.handleConfirmCheckout}
          onViewBookings={() => state.navigate('/bookings')}
        />
      )}
    </div>
  )
}
