import AppHeader from '../../components/layout/AppHeader'
import { ErrorPanel, LoadingPanel } from '../../components/ui/StatePanel'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import AdminBookingsHeader from './admin-bookings/AdminBookingsHeader'
import BookingFilters from './admin-bookings/BookingFilters'
import BookingListToolbar from './admin-bookings/BookingListToolbar'
import BookingMetricsCards from './admin-bookings/BookingMetricsCards'
import BookingPagination from './admin-bookings/BookingPagination'
import BookingTable from './admin-bookings/BookingTable'
import { useAdminBookings } from './admin-bookings/useAdminBookings'

export default function AdminBookings() {
  const state = useAdminBookings()
  useDocumentTitle('Pemesanan Masuk')

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader />

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <AdminBookingsHeader />

        {state.loading && (
          <LoadingPanel
            className="mt-8"
            title="Memuat pemesanan…"
            titleClassName="text-sm text-muted"
            minHeightClassName="min-h-[320px]"
          />
        )}

        {!state.loading && state.error && (
          <ErrorPanel
            className="mt-8"
            title="Gagal memuat pemesanan"
            description={state.error}
            onRetry={state.retry}
          />
        )}

        {!state.loading && !state.error && (
          <>
            <BookingMetricsCards state={state} />

            <section
              className="mt-6 overflow-hidden rounded-[10px] border border-line bg-surface "
              aria-busy={state.listLoading}
            >
              <BookingListToolbar state={state} />

              <BookingFilters state={state} />

              <BookingTable state={state} />

              {!state.listLoading && state.bookings.length === 0 && (
                <div className="border-t border-line px-6 py-10 text-center">
                  <p className="text-sm font-semibold text-ink">
                    {state.totalCount === 0 && !state.filtersActive
                      ? 'Belum ada pemesanan'
                      : 'Tidak ada pesanan yang cocok'}
                  </p>
                  <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted">
                    {state.totalCount === 0 && !state.filtersActive
                      ? 'Pemesanan dari tenant akan muncul di sini setelah mereka memilih booth.'
                      : 'Coba ubah kata kunci atau filter event dan status.'}
                  </p>
                </div>
              )}

              <BookingPagination state={state} />
            </section>

            <p className="mt-6 text-center text-[11px] text-muted">
              Verifikasi pembayaran akan mengubah status booth menjadi Booked secara otomatis.
            </p>
          </>
        )}
      </main>
    </div>
  )
}
