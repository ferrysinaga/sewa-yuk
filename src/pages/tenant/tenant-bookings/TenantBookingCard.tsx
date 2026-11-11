import InlineConfirm from '../../../components/ui/InlineConfirm'
import {
  formatCurrency,
  formatDateTime,
  formatRemaining,
  getPaymentInstruction,
  getRemainingMs,
  isExpiredBooking,
} from '../../../lib/booking'
import {
  BOOKING_EXPIRED_BADGE,
  BOOKING_EXPIRED_DOT,
  BOOKING_EXPIRED_LABEL,
  BOOKING_STATUS_BADGE,
  BOOKING_STATUS_DOT,
  BOOKING_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
} from '../../../types/booking'
import type { BookingRow } from '../../../types/booking'
import type { TenantBookingsState } from './useTenantBookings'

export default function TenantBookingCard({
  booking,
  state,
}: {
  booking: BookingRow
  state: TenantBookingsState
}) {
  const {
    blueprintById,
    now,
    updatingId,
    confirmingCancelId,
    setConfirmingCancelId,
    handleMarkPaid,
    handleCancel,
  } = state

  const event = blueprintById.get(booking.blueprint_id)
  const expired = isExpiredBooking(booking, now)
  const remainingMs = getRemainingMs(booking.expires_at, now)
  const instruction =
    booking.status === 'pending' && !expired
      ? getPaymentInstruction(booking.payment_method, booking)
      : null
  const isUpdating = updatingId === booking.id
  const confirmingCancel = confirmingCancelId === booking.id
  const bookingStatusLabel = expired ? BOOKING_EXPIRED_LABEL : BOOKING_STATUS_LABEL[booking.status]
  const statusBadge = expired ? BOOKING_EXPIRED_BADGE : BOOKING_STATUS_BADGE[booking.status]
  const statusDot = expired ? BOOKING_EXPIRED_DOT : BOOKING_STATUS_DOT[booking.status]

  return (
    <li className="overflow-hidden rounded-card border border-line bg-surface ">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold text-ink">{booking.booking_code}</span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-compact font-semibold ring-1 ring-inset ${statusBadge}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
              {bookingStatusLabel}
            </span>
          </div>
          <p className="mt-1 text-sm font-semibold text-ink">
            {event?.name ?? booking.blueprint_id}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {[event?.venue, event?.event_date].filter(Boolean).join(' · ') ||
              'Detail event tidak tersedia'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">Total</p>
          <p className="text-base font-semibold text-ink">{formatCurrency(booking.price)}</p>
        </div>
      </div>

      <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
        <dl className="space-y-2 text-xs">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">Booth</dt>
            <dd className="font-semibold text-ink">
              {booking.booth_category}
              {booking.booth_id ? ` · ${booking.booth_id.slice(0, 8)}` : ''}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">Metode pembayaran</dt>
            <dd className="font-semibold text-ink">
              {PAYMENT_METHOD_LABEL[booking.payment_method]}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">Dipesan</dt>
            <dd className="font-medium text-ink">{formatDateTime(booking.reserved_at)}</dd>
          </div>
          {booking.expires_at &&
            (booking.status === 'pending' || booking.status === 'awaiting_confirmation') && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">
                  {expired ? 'Batas pembayaran (terlewat)' : 'Batas pembayaran'}
                </dt>
                <dd className="text-right">
                  <span className="block font-medium text-clay-dark">
                    {formatDateTime(booking.expires_at)}
                  </span>
                  {booking.status === 'pending' && (
                    <span className="mt-0.5 block text-compact tabular-nums text-clay-dark">
                      {expired ? 'Kedaluwarsa' : `Sisa ${formatRemaining(remainingMs)}`}
                    </span>
                  )}
                </dd>
              </div>
            )}
          {booking.status === 'confirmed' && (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Dibayar</dt>
              <dd className="font-medium text-pine-dark">{formatDateTime(booking.paid_at)}</dd>
            </div>
          )}
          {booking.status === 'cancelled' && (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">
                {booking.cancelled_reason === 'expired' ? 'Kedaluwarsa' : 'Dibatalkan'}
              </dt>
              <dd className="font-medium text-ink">{formatDateTime(booking.cancelled_at)}</dd>
            </div>
          )}
        </dl>

        <div>
          {expired && booking.status === 'pending' && (
            <div className="rounded-card-sm border border-line bg-clay-soft p-3 text-xs leading-relaxed text-clay-dark">
              Batas pembayaran sudah lewat. Pesanan akan dibatalkan otomatis dan booth dilepas untuk
              penyewa lain. Tekan tombol Perbarui status untuk memperbarui sekarang.
            </div>
          )}

          {instruction && (
            <div className="rounded-card-sm border border-line bg-clay-soft p-3">
              <p className="text-compact font-semibold uppercase tracking-wide text-clay-dark">
                Instruksi pembayaran · {instruction.title}
              </p>
              <ul className="mt-2 space-y-1 text-xs text-ink">
                {instruction.lines.map((line) => (
                  <li key={line} className="font-medium">
                    {line}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-compact leading-relaxed text-clay-dark">{instruction.note}</p>
            </div>
          )}

          {booking.status === 'awaiting_confirmation' && (
            <div className="rounded-card-sm border border-line bg-pine-soft p-3 text-xs leading-relaxed text-pine-dark">
              Konfirmasi pembayaran sudah dikirim. Organizer akan memverifikasi dan mengubah status
              booth menjadi Booked.
            </div>
          )}

          {booking.status === 'confirmed' && (
            <div className="rounded-card-sm border border-line bg-pine-soft p-3 text-xs leading-relaxed text-pine-dark">
              Pembayaran terverifikasi. Booth sudah resmi menjadi milik Anda pada event ini.
            </div>
          )}

          {booking.status === 'cancelled' && (
            <div className="rounded-card-sm border border-line bg-unavailable p-3 text-xs leading-relaxed text-muted">
              {booking.cancelled_reason === 'expired'
                ? 'Pesanan kedaluwarsa karena batas pembayaran terlewat. Booth sudah dilepas dan dapat dipesan penyewa lain.'
                : 'Pesanan dibatalkan. Booth sudah dilepas dan dapat dipesan penyewa lain.'}
            </div>
          )}
        </div>
      </div>

      {(booking.status === 'pending' || booking.status === 'awaiting_confirmation') && (
        <div className="border-t border-line px-5 py-3">
          {confirmingCancel ? (
            <InlineConfirm
              id={`cancel-booking-${booking.id}`}
              title="Batalkan pesanan ini?"
              description="Booth akan tersedia kembali untuk penyewa lain. Tindakan ini tidak dapat dibatalkan."
              confirmLabel="Ya, batalkan pesanan"
              onConfirm={() => void handleCancel(booking)}
              onCancel={() => setConfirmingCancelId(null)}
              className="rounded-card-sm border border-danger bg-danger-soft p-3"
            />
          ) : (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmingCancelId(booking.id)}
                disabled={isUpdating}
                aria-expanded={confirmingCancel}
                aria-controls={`cancel-booking-${booking.id}`}
                className="inline-flex items-center justify-center rounded-card-sm border border-line bg-surface px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-danger hover:bg-danger-soft hover:text-danger-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Batalkan Pesanan
              </button>
              {booking.status === 'pending' && !expired && (
                <button
                  type="button"
                  onClick={() => void handleMarkPaid(booking)}
                  disabled={isUpdating}
                  className="inline-flex items-center justify-center gap-2 rounded-card-sm bg-pine px-4 py-2 text-xs font-semibold text-on-accent transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isUpdating ? 'Mengirim…' : 'Saya Sudah Bayar'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  )
}
