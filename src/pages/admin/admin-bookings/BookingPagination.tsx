import type { AdminBookingsState } from './useAdminBookings'

export default function BookingPagination({ state }: { state: AdminBookingsState }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
      <p className="text-xs tabular-nums text-muted" aria-live="polite">
        {state.listLoading
          ? 'Memuat pesanan…'
          : state.totalCount === 0
            ? 'Tidak ada pesanan'
            : `${state.pageStart}-${state.pageEnd} dari ${state.totalCount} pesanan`}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => state.goToPage(state.page - 1)}
          disabled={state.page <= 1 || state.listLoading}
          aria-label="Halaman sebelumnya"
          className="inline-flex items-center gap-1.5 rounded-[8px] border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Sebelumnya
        </button>
        <span className="text-xs tabular-nums text-muted">
          Halaman {state.page} dari {state.totalPages}
        </span>
        <button
          type="button"
          onClick={() => state.goToPage(state.page + 1)}
          disabled={state.page >= state.totalPages || state.listLoading}
          aria-label="Halaman berikutnya"
          className="inline-flex items-center gap-1.5 rounded-[8px] border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Berikutnya
        </button>
      </div>
    </div>
  )
}
