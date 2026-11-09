import { Link } from 'react-router-dom'
import SyncStatusBadge from '../../../components/ui/SyncStatusBadge'
import { BLUEPRINT_STATUS_BADGE, BLUEPRINT_STATUS_LABEL } from '../../../types/blueprint'
import type { TenantEventViewState } from './useTenantEventView'

function ArrowLeft() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M16 10H5m4-4-4 4 4 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function TenantEventHeader({ state }: { state: TenantEventViewState }) {
  const {
    blueprint,
    role,
    loading,
    error,
    syncStatus,
    lastSyncedAt,
    retry,
    availableCount,
    reservedCount,
    totalBooths,
  } = state

  return (
    <>
      <Link
        to="/event"
        className="inline-flex items-center gap-1.5 rounded-[4px] text-sm font-medium text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none"
      >
        <ArrowLeft />
        Kembali ke daftar event
      </Link>

      <div className="mt-4 flex flex-col justify-between gap-5 border-b border-line pb-6 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="h-px w-6 bg-clay" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              Denah acara
            </p>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-3xl">
              {blueprint?.name ?? 'Memuat event…'}
            </h1>
            {blueprint && blueprint.status !== 'published' && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${BLUEPRINT_STATUS_BADGE[blueprint.status]}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    blueprint.status === 'draft' ? 'bg-clay' : 'bg-muted'
                  }`}
                />
                {role === 'organizer'
                  ? 'Pratinjau organizer'
                  : BLUEPRINT_STATUS_LABEL[blueprint.status]}
              </span>
            )}
            <SyncStatusBadge
              status={syncStatus}
              lastUpdatedAt={lastSyncedAt}
              onRefresh={retry}
              refreshing={loading}
            />
          </div>

          {blueprint ? (
            <p className="mt-2 text-sm tabular-nums text-muted">
              {[blueprint.venue, blueprint.event_date].filter(Boolean).join(' · ')}
            </p>
          ) : (
            <div aria-hidden="true" className="mt-2 h-4 w-64 rounded-[3px] bg-unavailable" />
          )}

          {blueprint?.description && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
              {blueprint.description}
            </p>
          )}
        </div>

        {blueprint && !loading && !error && (
          <div className="w-full shrink-0 rounded-[10px] border border-line bg-surface px-5 py-4 sm:w-auto sm:min-w-[220px]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Ketersediaan
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
              {availableCount}
              <span className="ml-1 text-sm font-medium text-muted">/ {totalBooths} booth</span>
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              {reservedCount > 0
                ? `${reservedCount} booth sedang dipesan penyewa lain.`
                : 'Semua booth tersedia untuk dipilih.'}
            </p>
          </div>
        )}
      </div>
    </>
  )
}
