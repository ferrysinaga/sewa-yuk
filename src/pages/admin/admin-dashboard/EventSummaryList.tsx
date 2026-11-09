import { Link } from 'react-router-dom'
import {
  BLUEPRINT_STATUS_BADGE,
  BLUEPRINT_STATUS_LABEL,
} from '../../../types/blueprint'
import type { AdminDashboardState } from './useAdminDashboard'

export default function EventSummaryList({ dashboard }: { dashboard: AdminDashboardState }) {
  const { eventSummaries, blueprints, blueprintFilter, setBlueprintFilter } = dashboard

  return (
    <section className="rounded-[10px] border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">Ringkasan event</h2>
        <span className="text-xs tabular-nums text-muted">{blueprints.length}</span>
      </div>

      <ul className="mt-4 space-y-2">
        {eventSummaries.map((event) => {
          const isActive = blueprintFilter === event.id

          return (
            <li key={event.id}>
              <button
                type="button"
                onClick={() => setBlueprintFilter(isActive ? 'all' : event.id)}
                aria-pressed={isActive}
                className={`w-full rounded-[6px] border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none ${
                  isActive
                    ? 'border-pine bg-pine-soft'
                    : 'border-line bg-surface hover:border-pine'
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-xs font-semibold text-ink">
                      {event.name}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${BLUEPRINT_STATUS_BADGE[event.status]}`}
                    >
                      {BLUEPRINT_STATUS_LABEL[event.status]}
                    </span>
                  </span>
                </span>
                <span className="mt-1 block truncate text-[11px] text-muted">
                  {event.venue ?? 'Venue belum diatur'}
                </span>
                <span className="mt-2 block text-[11px] tabular-nums text-muted">
                  {event.available} dari {event.total} booth tersedia
                </span>
              </button>
              <Link
                to={`/admin/blueprint/${event.id}`}
                className="mt-1.5 inline-flex rounded-[4px] text-[11px] font-semibold text-pine-dark transition-colors hover:text-pine hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none"
              >
                Atur denah & booth
              </Link>
            </li>
          )
        })}
      </ul>

      {eventSummaries.length === 0 && (
        <p className="mt-4 rounded-[6px] border border-dashed border-line bg-canvas px-4 py-6 text-center text-xs leading-relaxed text-muted">
          Belum ada event atau blueprint aktif.
        </p>
      )}
    </section>
  )
}
