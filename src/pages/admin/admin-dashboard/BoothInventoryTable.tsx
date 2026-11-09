import { Link } from 'react-router-dom'
import { formatPrice } from '../../../lib/boothDisplay'
import type { BoothStatus } from '../../../types/booth'
import { categoryOptions, statusOptions } from './useAdminDashboard'
import type { AdminDashboardState } from './useAdminDashboard'

export default function BoothInventoryTable({ dashboard }: { dashboard: AdminDashboardState }) {
  const {
    blueprints,
    booths,
    filteredBooths,
    scopeBooths,
    blueprintNameById,
    categoryLabel,
    statusMeta,
    isLive,
    updatingIds,
    search,
    setSearch,
    blueprintFilter,
    setBlueprintFilter,
    categoryFilter,
    setCategoryFilter,
    statusFilter,
    setStatusFilter,
    reload,
    handleStatusChange,
  } = dashboard

  return (
    <section className="overflow-hidden rounded-[10px] border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-base font-semibold text-ink">Inventaris booth</h2>
            <span
              className={`inline-flex items-center gap-1.5 rounded-[4px] border px-2.5 py-1 text-[11px] font-medium ${
                isLive
                  ? 'border-line bg-pine-soft text-pine'
                  : 'border-line bg-unavailable text-muted'
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-pine' : 'bg-muted'}`}
              />
              {isLive ? 'Live' : 'Menghubungkan…'}
            </span>
          </div>
          <p className="mt-1 text-xs tabular-nums text-muted">
            {filteredBooths.length} dari {scopeBooths.length} booth ditampilkan
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          className="inline-flex items-center gap-1.5 rounded-[6px] border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-3.5 w-3.5">
            <path
              fillRule="evenodd"
              d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z"
              clipRule="evenodd"
            />
          </svg>
          Muat ulang
        </button>
      </div>

      <div className="grid gap-2 border-b border-line px-5 py-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="admin-search" className="sr-only">
            Cari booth
          </label>
          <input
            id="admin-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari ID, kategori, event…"
            className="w-full rounded-[6px] border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-pine focus:ring-2 focus:ring-pine-soft motion-reduce:transition-none"
          />
        </div>
        <div>
          <label htmlFor="admin-event-filter" className="sr-only">
            Filter event
          </label>
          <select
            id="admin-event-filter"
            value={blueprintFilter}
            onChange={(event) => setBlueprintFilter(event.target.value)}
            className="w-full rounded-[6px] border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-pine focus:ring-2 focus:ring-pine-soft motion-reduce:transition-none"
          >
            <option value="all">Semua event</option>
            {blueprints.map((blueprint) => (
              <option key={blueprint.id} value={blueprint.id}>
                {blueprint.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="admin-category-filter" className="sr-only">
            Filter kategori
          </label>
          <select
            id="admin-category-filter"
            value={categoryFilter}
            onChange={(event) =>
              setCategoryFilter(event.target.value as typeof categoryFilter)
            }
            className="w-full rounded-[6px] border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-pine focus:ring-2 focus:ring-pine-soft motion-reduce:transition-none"
          >
            <option value="all">Semua kategori</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {categoryLabel[category]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="admin-status-filter" className="sr-only">
            Filter status
          </label>
          <select
            id="admin-status-filter"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as BoothStatus | 'all')
            }
            className="w-full rounded-[6px] border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-pine focus:ring-2 focus:ring-pine-soft motion-reduce:transition-none"
          >
            <option value="all">Semua status</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {statusMeta[status].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[860px] w-full divide-y divide-line text-left text-sm">
          <thead className="bg-canvas text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            <tr>
              <th scope="col" className="px-5 py-3">
                Booth
              </th>
              <th scope="col" className="px-5 py-3">
                Event
              </th>
              <th scope="col" className="px-5 py-3">
                Kategori
              </th>
              <th scope="col" className="px-5 py-3 text-right">
                Harga
              </th>
              <th scope="col" className="px-5 py-3">
                Status
              </th>
              <th scope="col" className="px-5 py-3 text-right">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filteredBooths.map((booth) => {
              const meta = statusMeta[booth.status]
              const isUpdating = updatingIds.includes(booth.id)

              return (
                <tr key={booth.id} className="transition-colors hover:bg-canvas motion-reduce:transition-none">
                  <td className="whitespace-nowrap px-5 py-3.5">
                    <p className="font-mono text-xs font-semibold text-ink" title={booth.id}>
                      {booth.id.slice(0, 8)}
                    </p>
                    <p className="mt-0.5 text-[11px] tabular-nums text-muted">
                      {booth.width} × {booth.height} px
                    </p>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="max-w-[220px] truncate text-xs font-medium text-ink">
                      {blueprintNameById.get(booth.blueprint_id) ?? booth.blueprint_id}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5">
                    <span className="inline-flex rounded-[4px] border border-line bg-canvas px-2 py-0.5 text-[11px] font-medium text-muted">
                      {categoryLabel[booth.category]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-right text-xs font-medium tabular-nums text-ink">
                    {formatPrice(booth.price)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-[4px] px-2.5 py-1 text-[11px] font-semibold ${meta.badge}`}
                    >
                      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <label className="sr-only" htmlFor={`status-${booth.id}`}>
                        Ubah status booth {booth.id.slice(0, 8)}
                      </label>
                      <select
                        id={`status-${booth.id}`}
                        value={booth.status}
                        onChange={(event) =>
                          void handleStatusChange(booth, event.target.value as BoothStatus)
                        }
                        disabled={isUpdating}
                        className="rounded-[6px] border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink outline-none transition-colors focus:border-pine focus:ring-2 focus:ring-pine-soft disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
                      >
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>
                            {statusMeta[status].label}
                          </option>
                        ))}
                      </select>
                      {booth.status !== 'Available' && (
                        <button
                          type="button"
                          onClick={() => void handleStatusChange(booth, 'Available')}
                          disabled={isUpdating}
                          className="rounded-[4px] px-2 py-1.5 text-[11px] font-semibold text-muted transition-colors hover:bg-pine-soft hover:text-pine focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
                        >
                          Batalkan
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {filteredBooths.length === 0 && (
        <div className="border-t border-line px-6 py-10 text-center">
          <p className="text-sm font-semibold text-ink">
            {booths.length === 0 ? 'Belum ada booth terdaftar' : 'Tidak ada booth yang cocok'}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted">
            {booths.length === 0
              ? 'Tambahkan booth melalui halaman Kelola Denah agar inventaris muncul di sini.'
              : 'Coba ubah kata kunci atau filter event, kategori, dan status.'}
          </p>
          {booths.length === 0 && (
            <Link
              to="/admin/blueprint"
              className="mt-4 inline-flex items-center justify-center rounded-[6px] bg-pine px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none"
            >
              Buka Kelola Denah
            </Link>
          )}
        </div>
      )}
    </section>
  )
}
