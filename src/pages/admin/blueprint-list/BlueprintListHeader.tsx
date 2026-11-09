import { Link } from 'react-router-dom'

interface BlueprintListHeaderProps {
  showCreate: boolean
  onToggleCreate: () => void
}

export default function BlueprintListHeader({
  showCreate,
  onToggleCreate,
}: BlueprintListHeaderProps) {
  return (
    <>
      <Link
        to="/admin"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path
            fillRule="evenodd"
            d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z"
            clipRule="evenodd"
          />
        </svg>
        Kembali ke dashboard
      </Link>

      <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="h-px w-6 bg-clay" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              Ruang kerja organizer
            </p>
          </div>
          <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-4xl">
            Kelola Denah
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Buat denah event, susun booth, lalu publikasikan agar tenant dapat melihat dan memilih
            booth dari halaman event.
          </p>
        </div>

        <button
          type="button"
          onClick={onToggleCreate}
          aria-expanded={showCreate}
          className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-pine px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
          </svg>
          {showCreate ? 'Tutup Form' : 'Buat Denah Baru'}
        </button>
      </div>
    </>
  )
}
