import { formatCurrency } from '../../../lib/booking'
import type { TenantBookingsState } from './useTenantBookings'

export default function BookingMetrics({ state }: { state: TenantBookingsState }) {
  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-3">
      <div className="rounded-[10px] border border-line bg-surface p-5 ">
        <p className="text-xs font-medium text-muted">Pesanan aktif</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">
          {state.metrics.active}
        </p>
        <p className="mt-1 text-xs text-muted">Menunggu pembayaran atau verifikasi</p>
      </div>
      <div className="rounded-[10px] border border-line bg-surface p-5 ">
        <p className="text-xs font-medium text-muted">Terkonfirmasi</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">
          {state.metrics.confirmed}
        </p>
        <p className="mt-1 text-xs text-muted">Booth sudah menjadi milik Anda</p>
      </div>
      <div className="rounded-[10px] border border-line bg-surface p-5 ">
        <p className="text-xs font-medium text-muted">Total dibayar</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">
          {formatCurrency(state.metrics.totalPaid)}
        </p>
        <p className="mt-1 text-xs text-muted">Dari pesanan terkonfirmasi</p>
      </div>
    </div>
  )
}
