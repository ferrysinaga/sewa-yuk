import { Link } from 'react-router-dom'

export default function AdminBookingsHeader() {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="h-px w-6 bg-clay" />
          <p className="text-compact font-semibold uppercase tracking-[0.18em] text-muted">
            Dashboard penyelenggara
          </p>
        </div>
        <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-4xl">
          Pemesanan Booth
        </h1>
        <p className="mt-2 text-sm text-muted">
          Verifikasi pembayaran penyewa dan pantau seluruh pesanan booth.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          to="/admin"
          className="inline-flex items-center justify-center gap-2 rounded-card-sm border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2"
        >
          Dashboard
        </Link>
        <Link
          to="/admin/blueprint"
          className="inline-flex items-center justify-center gap-2 rounded-card-sm border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2"
        >
          Kelola Denah
        </Link>
      </div>
    </div>
  )
}
