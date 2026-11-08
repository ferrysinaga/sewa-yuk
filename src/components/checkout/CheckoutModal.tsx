import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Booth } from '../../types/booth'
import {
  BOOKING_HOLD_HOURS,
  PAYMENT_METHOD_DESCRIPTION,
  PAYMENT_METHOD_LABEL,
  PAYMENT_METHOD_OPTIONS,
} from '../../types/booking'
import type { PaymentMethod } from '../../types/booking'
import { formatCurrency } from '../../lib/booking'
import { BOOTH_CATEGORY_LABEL as categoryLabel } from '../../lib/boothDisplay'
import Spinner from '../ui/Spinner'

interface CheckoutModalProps {
  booth: Booth
  eventName?: string
  reserved: boolean
  bookingCode?: string | null
  confirming: boolean
  onClose: () => void
  onConfirm: (paymentMethod: PaymentMethod) => void
  onViewBookings: () => void
}

export default function CheckoutModal({
  booth,
  eventName,
  reserved,
  bookingCode,
  confirming,
  onClose,
  onConfirm,
  onViewBookings,
}: CheckoutModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('va')
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  const isAvailable = booth.status === 'Available'

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const previousActive =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      previousActive?.focus()
    }
  }, [])

  useEffect(() => {
    const getFocusable = () =>
      Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => element.getClientRects().length > 0)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !confirming) {
        onClose()
        return
      }

      if (event.key !== 'Tab') return

      const focusable = getFocusable()
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement

      if (!dialogRef.current?.contains(active)) {
        event.preventDefault()
        first.focus()
        return
      }

      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [confirming, onClose])

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-overlay"
        onClick={() => {
          if (!confirming) onClose()
        }}
        aria-hidden="true"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-title"
        className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[10px] border border-line bg-surface sm:rounded-[10px]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div>
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="h-1.5 w-1.5 bg-clay" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                {reserved ? 'Booth terkunci' : 'Konfirmasi'}
              </p>
            </div>
            <h2 id="checkout-title" className="mt-1.5 text-lg font-semibold tracking-tight text-ink">
              {reserved ? 'Booth berhasil dikunci' : 'Konfirmasi pemesanan'}
            </h2>
            <p className="mt-0.5 text-xs text-muted">{eventName ?? 'Penyewaan booth event'}</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => {
              if (!confirming) onClose()
            }}
            disabled={confirming}
            aria-label="Tutup dialog pemesanan"
            className="-m-1.5 inline-flex h-11 w-11 items-center justify-center rounded-[4px] text-muted transition-colors hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-5 w-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5 sm:px-6">
          {reserved ? (
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[10px] bg-pine-soft text-pine">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="h-7 w-7">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-ink">Booth aman untuk Anda</h3>
              <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted">
                Booth {categoryLabel[booth.category]} telah dikunci sementara dan ditandai tidak
                tersedia untuk penyewa lain di peta.
              </p>

              <dl className="mt-5 space-y-2 rounded-[6px] border border-line bg-canvas p-4 text-left text-sm">
                {bookingCode && (
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-muted">Kode pesanan</dt>
                    <dd className="font-mono text-xs font-semibold text-ink">{bookingCode}</dd>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">Booth</dt>
                  <dd className="font-semibold tabular-nums text-ink">
                    {categoryLabel[booth.category]} · {booth.id.slice(0, 8)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">Ukuran</dt>
                  <dd className="font-semibold tabular-nums text-ink">
                    {booth.width} × {booth.height} px
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-line pt-2">
                  <dt className="text-muted">Total</dt>
                  <dd className="font-semibold tabular-nums text-ink">{formatCurrency(booth.price)}</dd>
                </div>
              </dl>

              <p className="mt-4 text-xs leading-relaxed text-muted">
                Status booth: <span className="font-semibold text-ink">Dipesan</span>. Selesaikan
                pembayaran dalam {BOOKING_HOLD_HOURS} jam melalui halaman Pesanan Saya.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 rounded-[6px] border border-line bg-canvas p-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-muted">{eventName}</p>
                  <p className="mt-1 text-base font-semibold text-ink">
                    {categoryLabel[booth.category]}
                  </p>
                  <p className="text-xs tabular-nums text-muted">
                    Booth {booth.id.slice(0, 8)} · {booth.width} × {booth.height} px
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-[4px] px-2.5 py-1 text-[11px] font-semibold ${
                    isAvailable
                      ? 'border border-line bg-pine-soft text-pine'
                      : 'border border-line bg-unavailable-deep text-ink'
                  }`}
                >
                  {isAvailable ? 'Tersedia' : 'Tidak tersedia'}
                </span>
              </div>

              {!isAvailable && (
                <div className="mt-4 rounded-[6px] border border-line bg-unavailable p-4 text-sm leading-relaxed text-ink">
                  Booth ini baru saja diamankan oleh penyewa lain. Pilih booth lain yang masih
                  bertanda tersedia pada peta.
                </div>
              )}

              <dl className="mt-4 space-y-2.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">Harga sewa booth</dt>
                  <dd className="font-medium tabular-nums text-ink">{formatCurrency(booth.price)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">Biaya layanan</dt>
                  <dd className="font-medium tabular-nums text-ink">{formatCurrency(0)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-line pt-2.5">
                  <dt className="font-semibold text-ink">Total pembayaran</dt>
                  <dd className="text-base font-semibold tabular-nums text-ink">
                    {formatCurrency(booth.price)}
                  </dd>
                </div>
              </dl>

              <fieldset className="mt-5">
                <legend className="text-sm font-medium text-ink">Metode pembayaran</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {PAYMENT_METHOD_OPTIONS.map((method) => {
                    const isSelected = paymentMethod === method

                    return (
                      <label
                        key={method}
                        className={`cursor-pointer rounded-[6px] border p-3 transition-colors focus-within:ring-2 focus-within:ring-pine focus-within:ring-offset-2 focus-within:ring-offset-surface motion-reduce:transition-none ${
                          isSelected
                            ? 'border-pine bg-pine-soft'
                            : 'border-line bg-surface hover:border-pine'
                        }`}
                      >
                        <input
                          type="radio"
                          name="payment-method"
                          value={method}
                          checked={isSelected}
                          onChange={() => setPaymentMethod(method)}
                          className="sr-only"
                        />
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-ink">
                            {PAYMENT_METHOD_LABEL[method]}
                          </span>
                          <span
                            aria-hidden="true"
                            className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${
                              isSelected ? 'border-pine bg-pine' : 'border-line bg-surface'
                            }`}
                          >
                            {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                          </span>
                        </span>
                        <span className="mt-1 block text-[11px] leading-snug text-muted">
                          {PAYMENT_METHOD_DESCRIPTION[method]}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>

              <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-muted">
                <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted">
                  <path
                    fillRule="evenodd"
                    d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z"
                    clipRule="evenodd"
                  />
                </svg>
                Saat dikonfirmasi, pesanan dibuat dan booth dikunci untuk Anda. Selesaikan
                pembayaran dalam {BOOKING_HOLD_HOURS} jam agar booth dapat terisi.
              </p>
            </>
          )}
        </div>

        <div className="border-t border-line px-5 py-4 sm:px-6">
          {reserved ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-[6px] border border-line bg-surface px-5 py-3 text-sm font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none"
              >
                Selesai
              </button>
              <button
                type="button"
                onClick={onViewBookings}
                className="inline-flex items-center justify-center gap-2 rounded-[6px] bg-pine px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none"
              >
                Lihat Pesanan Saya
              </button>
            </div>
          ) : (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={confirming}
                className="inline-flex items-center justify-center rounded-[6px] border border-line bg-surface px-5 py-3 text-sm font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isAvailable) {
                    onConfirm(paymentMethod)
                  } else {
                    onClose()
                  }
                }}
                disabled={confirming}
                className="inline-flex items-center justify-center gap-2 rounded-[6px] bg-pine px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
              >
                {confirming ? (
                  <>
                    <Spinner size="md" tone="white" />
                    Membuat Pesanan…
                  </>
                ) : isAvailable ? (
                  'Buat Pesanan & Kunci Booth'
                ) : (
                  'Pilih booth lain'
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
