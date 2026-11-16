import { Fragment } from 'react'
import InlineConfirm from '../../../components/ui/InlineConfirm'
import { formatCurrency, formatDateTime } from '../../../lib/booking'
import { getBookingStatusView } from '../../../lib/bookingStatus'
import { PAYMENT_METHOD_LABEL } from '../../../types/booking'
import type { AdminBookingsState } from './useAdminBookings'

export default function BookingTable({ state }: { state: AdminBookingsState }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[980px] w-full divide-y divide-line text-left text-sm">
        <thead className="bg-canvas text-tiny font-semibold uppercase tracking-[0.12em] text-muted">
          <tr>
            <th scope="col" className="px-4 py-3">
              Kode
            </th>
            <th scope="col" className="px-4 py-3">
              Tenant
            </th>
            <th scope="col" className="px-4 py-3">
              Event
            </th>
            <th scope="col" className="px-4 py-3">
              Booth
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Total
            </th>
            <th scope="col" className="px-4 py-3">
              Status
            </th>
            <th scope="col" className="px-4 py-3">
              Dibuat
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Aksi
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {state.bookings.map((booking) => {
            const event = state.blueprintById.get(booking.blueprint_id)
            const isUpdating = state.updatingId === booking.id
            const view = getBookingStatusView(booking, state.now)
            const confirmingCancel = state.confirmingCancelId === booking.id

            return (
              <Fragment key={booking.id}>
                <tr className="transition-colors hover:bg-canvas">
                  <td className="whitespace-nowrap px-4 py-3.5">
                    <p className="font-mono text-xs font-semibold text-ink">
                      {booking.booking_code}
                    </p>
                    <p className="mt-0.5 text-compact text-muted">
                      {PAYMENT_METHOD_LABEL[booking.payment_method]}
                    </p>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="max-w-[180px] truncate text-xs font-medium text-ink">
                      {booking.tenant_name || 'Nama tenant belum diisi'}
                    </p>
                    <p className="max-w-[180px] truncate text-compact text-muted">
                      {booking.tenant_email || '—'}
                    </p>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="max-w-[200px] truncate text-xs font-medium text-ink">
                      {event?.name ?? booking.blueprint_id}
                    </p>
                    <p className="max-w-[200px] truncate text-compact text-muted">
                      {event?.venue ?? '—'}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5">
                    <span className="inline-flex rounded-full bg-unavailable px-2.5 py-1 text-compact font-medium text-ink ring-1 ring-inset ring-line">
                      {booking.booth_category}
                    </span>
                    <p className="mt-1 font-mono text-compact text-muted">
                      {booking.booth_id ? booking.booth_id.slice(0, 8) : 'Booth dihapus'}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-right text-xs font-medium text-ink">
                    {formatCurrency(booking.price)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-compact font-semibold ring-1 ring-inset ${view.badge}`}
                    >
                      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${view.dot}`} />
                      {view.label}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-compact text-muted">
                    {formatDateTime(booking.created_at)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      {view.canCancel ? (
                        <>
                          {view.canConfirm && (
                            <button
                              type="button"
                              onClick={() => void state.handleConfirm(booking)}
                              disabled={isUpdating}
                              aria-label={`Konfirmasi pembayaran ${booking.booking_code}`}
                              className="rounded-control bg-pine px-3 py-1.5 text-compact font-semibold text-on-accent transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isUpdating ? 'Memproses…' : 'Konfirmasi'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => state.setConfirmingCancelId(booking.id)}
                            disabled={isUpdating}
                            aria-expanded={confirmingCancel}
                            aria-controls={`cancel-booking-${booking.id}`}
                            aria-label={`Batalkan pesanan ${booking.booking_code}`}
                            className="rounded-control px-2 py-1.5 text-compact font-semibold text-muted transition-colors hover:bg-danger-soft hover:text-danger-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Batalkan
                          </button>
                        </>
                      ) : (
                        <span className="text-compact text-muted">—</span>
                      )}
                    </div>
                  </td>
                </tr>

                {confirmingCancel && (
                  <tr className="bg-canvas">
                    <td colSpan={8} className="px-4 py-3">
                      <InlineConfirm
                        id={`cancel-booking-${booking.id}`}
                        title={`Batalkan pesanan ${booking.booking_code}?`}
                        description="Booth akan tersedia kembali untuk penyewa lain. Tindakan ini tidak dapat dibatalkan."
                        confirmLabel="Ya, batalkan pesanan"
                        onConfirm={() => void state.handleCancel(booking)}
                        onCancel={() => state.setConfirmingCancelId(null)}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
