import { formatCurrency } from '../../../lib/booking'
import type { AdminBookingsState } from './useAdminBookings'

export default function BookingMetricsCards({ state }: { state: AdminBookingsState }) {
  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-[10px] border border-line bg-surface p-5 ">
        <p className="text-xs font-medium text-muted">Total pesanan</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">
          {state.metricRows.length}
        </p>
        <p className="mt-1 text-xs text-muted">{state.metrics.pending} menunggu pembayaran</p>
      </div>
      <div className="rounded-[10px] border border-line bg-clay-soft p-5 ">
        <p className="text-xs font-medium text-clay-dark">Perlu verifikasi</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-clay-dark">
          {state.metrics.awaiting}
        </p>
        <p className="mt-1 text-xs text-clay-dark">Penyewa sudah menandai sudah bayar</p>
      </div>
      <div className="rounded-[10px] border border-line bg-surface p-5 ">
        <p className="text-xs font-medium text-muted">Terkonfirmasi</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">
          {state.metrics.confirmed}
        </p>
        <p className="mt-1 text-xs text-muted">Booth sudah menjadi Booked</p>
      </div>
      <div className="rounded-[10px] border border-line bg-surface p-5 ">
        <p className="text-xs font-medium text-muted">Pendapatan terkonfirmasi</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">
          {formatCurrency(state.metrics.revenue)}
        </p>
        <p className="mt-1 text-xs text-muted">Dari pesanan terkonfirmasi</p>
      </div>
    </div>
  )
}
