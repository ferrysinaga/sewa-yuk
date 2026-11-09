import type { RealtimeStatus } from '../../lib/realtimeStatus'

interface SyncStatusBadgeProps {
  status: RealtimeStatus
  lastUpdatedAt?: number | null
  onRefresh?: () => void
  refreshing?: boolean
}

const STATUS_META: Record<RealtimeStatus, { label: string; badge: string; dot: string }> = {
  live: {
    label: 'Sinkron real-time',
    badge: 'bg-pine-soft text-pine-dark',
    dot: 'bg-pine',
  },
  connecting: {
    label: 'Menghubungkan…',
    badge: 'bg-unavailable text-muted',
    dot: 'bg-muted',
  },
  disconnected: {
    label: 'Koneksi terputus',
    badge: 'bg-clay-soft text-clay-dark',
    dot: 'bg-clay',
  },
}

function formatUpdatedAt(value: number | null | undefined): string | null {
  if (!value || !Number.isFinite(value)) return null

  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export default function SyncStatusBadge({
  status,
  lastUpdatedAt,
  onRefresh,
  refreshing = false,
}: SyncStatusBadgeProps) {
  const meta = STATUS_META[status]
  const updatedAt = formatUpdatedAt(lastUpdatedAt)

  return (
    <span className="inline-flex flex-wrap items-center gap-2" role="status" aria-live="polite">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ring-line ${meta.badge}`}
      >
        <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
        {meta.label}
      </span>

      {status === 'disconnected' && (
        <>
          <span className="text-[11px] text-muted">
            {updatedAt ? `Terakhir diperbarui ${updatedAt}` : 'Belum ada pembaruan'}
          </span>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="rounded-[6px] border border-line bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
            >
              {refreshing ? 'Memuat…' : 'Muat ulang data'}
            </button>
          )}
        </>
      )}
    </span>
  )
}
