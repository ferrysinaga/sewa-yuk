import { Link } from 'react-router-dom'

export default function BookingEmptyState({ hasBookings }: { hasBookings: boolean }) {
  return (
    <div className="mt-6 rounded-card border border-line bg-surface p-10 text-center ">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-card bg-pine-soft text-pine">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="h-6 w-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12h6m-6 4h6m2 4H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V18a2 2 0 0 1-2 2Z"
          />
        </svg>
      </div>
      <h2 className="mt-4 text-lg font-semibold text-ink">
        {hasBookings ? 'Tidak ada pesanan pada filter ini' : 'Belum ada pesanan'}
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
        {hasBookings
          ? 'Coba pilih filter status lain untuk melihat pesanan Anda.'
          : 'Pilih booth pada peta event untuk membuat pesanan pertama Anda.'}
      </p>
      {!hasBookings && (
        <Link
          to="/event"
          className="mt-5 inline-flex items-center justify-center rounded-card-sm bg-pine px-5 py-2.5 text-sm font-semibold text-on-accent transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2"
        >
          Cari Booth
        </Link>
      )}
    </div>
  )
}
