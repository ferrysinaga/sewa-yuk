import { BOOTH_STATUS_LABEL as statusLabel } from '../../lib/boothDisplay'
import type { BoothStatus } from './landingContent'

export function ArrowRight({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M4 10h11m-4-4 4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ArrowDown({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M10 4v11m-4-4 4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function CheckIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pine"
    >
      <path
        d="m3.5 8.5 3 3 6-7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function BrandMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-[7px] bg-pine text-white ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
        <rect x="4" y="4" width="7" height="6" rx="1" stroke="currentColor" strokeWidth="1.6" />
        <rect x="13" y="4" width="7" height="6" rx="1" stroke="currentColor" strokeWidth="1.6" />
        <rect x="4" y="12" width="7" height="8" rx="1" stroke="currentColor" strokeWidth="1.6" />
        <rect x="13" y="12" width="7" height="8" rx="1" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    </span>
  )
}

export function StatusBadge({ status }: { status: BoothStatus }) {
  const tone =
    status === 'Available'
      ? 'bg-pine-soft text-pine'
      : status === 'Reserved'
        ? 'border border-dashed border-muted bg-unavailable text-ink'
        : 'bg-unavailable-deep text-ink'

  return (
    <span
      className={`inline-flex items-center rounded-[4px] px-2 py-0.5 text-[11px] font-semibold ${tone}`}
    >
      {statusLabel[status]}
    </span>
  )
}
