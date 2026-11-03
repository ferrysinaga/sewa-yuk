import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Booth } from '../../types/booth'

const paymentMethods = [
  { id: 'va', label: 'Virtual Account', description: 'BCA, BNI, Mandiri' },
  { id: 'transfer', label: 'Transfer Bank', description: 'Konfirmasi manual' },
  { id: 'qris', label: 'QRIS', description: 'Semua e-wallet' },
] as const

type PaymentMethod = (typeof paymentMethods)[number]['id']

const formatPrice = (price: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(price)

interface CheckoutModalProps {
  booth: Booth
  eventName?: string
  reserved: boolean
  confirming: boolean
  onClose: () => void
  onConfirm: () => void
}

export default function CheckoutModal({
  booth,
  eventName,
  reserved,
  confirming,
  onClose,
  onConfirm,
}: CheckoutModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('va')
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const isAvailable = booth.status === 'Available'

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !confirming) onClose()
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [confirming, onClose])

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
        onClick={() => {
          if (!confirming) onClose()
        }}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-title"
        className="relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 sm:px-6">
          <div>
            <h2 id="checkout-title" className="text-lg font-semibold tracking-tight text-gray-900">
              {reserved ? 'Booth Berhasil Dikunci' : 'Konfirmasi Pemesanan'}
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {eventName ?? 'Penyewaan booth event'}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => {
              if (!confirming) onClose()
            }}
            disabled={confirming}
            aria-label="Tutup dialog pemesanan"
            className="rounded-xl p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5 sm:px-6">
          {reserved ? (
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">Booth aman untuk Anda</h3>
              <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-gray-500">
                Booth {booth.category} telah dikunci sementara dan langsung ditandai terisi untuk penyewa
                lain di peta.
              </p>

              <dl className="mt-5 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-4 text-left text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-gray-500">Booth</dt>
                  <dd className="font-semibold text-gray-900">
                    {booth.category} · {booth.id.slice(0, 8)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-gray-500">Ukuran</dt>
                  <dd className="font-semibold text-gray-900">
                    {booth.width} × {booth.height} px
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-gray-500">Total</dt>
                  <dd className="font-semibold text-gray-900">{formatPrice(booth.price)}</dd>
                </div>
              </dl>

              <p className="mt-4 text-xs leading-relaxed text-gray-500">
                Status booth: <span className="font-semibold text-gray-700">Reserved</span>. Selesaikan
                pembayaran untuk mengubahnya menjadi Booked.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div>
                  <p className="text-xs text-gray-500">{eventName}</p>
                  <p className="mt-1 text-base font-semibold text-gray-900">{booth.category}</p>
                  <p className="text-xs text-gray-500">
                    Booth {booth.id.slice(0, 8)} · {booth.width} × {booth.height} px
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${
                    isAvailable
                      ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
                      : 'bg-gray-100 text-gray-600 ring-gray-200'
                  }`}
                >
                  {isAvailable ? 'Tersedia' : 'Tidak Tersedia'}
                </span>
              </div>

              {!isAvailable && (
                <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-relaxed text-gray-600">
                  Booth ini baru saja diamankan oleh penyewa lain. Pilih booth lain yang masih berwarna
                  hijau pada peta.
                </div>
              )}

              <dl className="mt-4 space-y-2.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-gray-500">Harga sewa booth</dt>
                  <dd className="font-medium text-gray-900">{formatPrice(booth.price)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-gray-500">Biaya layanan</dt>
                  <dd className="font-medium text-gray-900">{formatPrice(0)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-gray-200 pt-2.5">
                  <dt className="font-semibold text-gray-900">Total pembayaran</dt>
                  <dd className="text-base font-semibold text-gray-900">{formatPrice(booth.price)}</dd>
                </div>
              </dl>

              <fieldset className="mt-5">
                <legend className="text-sm font-medium text-gray-900">Metode pembayaran</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {paymentMethods.map((method) => {
                    const isSelected = paymentMethod === method.id

                    return (
                      <label
                        key={method.id}
                        className={`cursor-pointer rounded-xl border p-3 shadow-sm transition-colors focus-within:ring-2 focus-within:ring-blue-600 focus-within:ring-offset-2 ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/60'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="payment-method"
                          value={method.id}
                          checked={isSelected}
                          onChange={() => setPaymentMethod(method.id)}
                          className="sr-only"
                        />
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-gray-900">{method.label}</span>
                          <span
                            aria-hidden="true"
                            className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${
                              isSelected ? 'border-blue-600 bg-blue-600' : 'border-gray-300 bg-white'
                            }`}
                          >
                            {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                          </span>
                        </span>
                        <span className="mt-1 block text-[11px] leading-snug text-gray-500">
                          {method.description}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>

              <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-gray-500">
                <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-500">
                  <path
                    fillRule="evenodd"
                    d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z"
                    clipRule="evenodd"
                  />
                </svg>
                Saat dikonfirmasi, status booth langsung berubah menjadi Reserved dan tidak dapat diambil
                penyewa lain.
              </p>
            </>
          )}
        </div>

        <div className="border-t border-gray-200 px-5 py-4 sm:px-6">
          {reserved ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              Selesai
            </button>
          ) : (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={confirming}
                className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-900 shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={isAvailable ? onConfirm : onClose}
                disabled={confirming}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {confirming ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                    />
                    Mengunci Booth…
                  </>
                ) : isAvailable ? (
                  'Kunci Booth & Lanjut Bayar'
                ) : (
                  'Pilih Booth Lain'
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
