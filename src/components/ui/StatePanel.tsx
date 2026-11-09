import type { ReactNode } from 'react'
import Spinner from './Spinner'

interface LoadingPanelProps {
  title: string
  description?: string
  /** Jarak/posisi pembungkus. Default `mt-6`. */
  className?: string
  /** Tinggi minimum untuk varian panel. Default `min-h-[280px]`. */
  minHeightClassName?: string
  /** Kelas judul untuk panel yang ingin lebih tenang. */
  titleClassName?: string
  variant?: 'panel' | 'bare'
}

/**
 * Panel loading bersama. `role="status"` dan `aria-live="polite"` membuat
 * perubahan status dibacakan screen reader tanpa memindahkan fokus.
 */
export function LoadingPanel({
  title,
  description,
  className = 'mt-6',
  minHeightClassName = 'min-h-[280px]',
  titleClassName = 'text-sm font-medium text-ink',
  variant = 'panel',
}: LoadingPanelProps) {
  const shellClassName =
    variant === 'panel'
      ? `${minHeightClassName} flex items-center justify-center rounded-[10px] border border-line bg-surface px-6`
      : 'flex flex-col items-center justify-center'

  return (
    <div role="status" aria-live="polite" className={`${shellClassName} ${className}`}>
      <div className="flex flex-col items-center gap-3 text-center">
        <Spinner size="lg" tone="pine" />
        <p className={titleClassName}>{title}</p>
        {description && (
          <p className="max-w-xs text-xs leading-relaxed text-muted">{description}</p>
        )}
      </div>
    </div>
  )
}

interface ErrorPanelProps {
  title: string
  description: ReactNode
  onRetry?: () => void
  retryLabel?: string
  iconTone?: 'danger' | 'clay'
  secondaryAction?: ReactNode
  showIcon?: boolean
  variant?: 'panel' | 'inline'
  className?: string
}

function AlertIcon({ tone }: { tone: 'danger' | 'clay' }) {
  const toneClassName =
    tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-clay-soft text-clay-dark'

  return (
    <div
      className={`mx-auto flex h-12 w-12 items-center justify-center rounded-[10px] ${toneClassName}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="h-6 w-6"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m0 3.75h.008v.008H12v-.008ZM10.34 3.94 2.7 17.54A1.5 1.5 0 0 0 4 19.75h16a1.5 1.5 0 0 0 1.3-2.21L13.66 3.94a1.5 1.5 0 0 0-2.62 0Z"
        />
      </svg>
    </div>
  )
}

/**
 * Panel error bersama. Varian `inline` dipakai untuk kegagalan yang tidak
 * menghalangi seluruh halaman, misalnya editor denah.
 */
export function ErrorPanel({
  title,
  description,
  onRetry,
  retryLabel = 'Coba lagi',
  iconTone = 'danger',
  secondaryAction,
  showIcon = true,
  variant = 'panel',
  className = 'mt-6',
}: ErrorPanelProps) {
  if (variant === 'inline') {
    return (
      <div
        role="alert"
        className={`${className} flex flex-col gap-3 rounded-[10px] border border-danger bg-danger-soft px-4 py-4 text-sm text-danger-dark sm:flex-row sm:items-center sm:justify-between`}
      >
        <p className="leading-relaxed">
          {title}: {description}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex shrink-0 items-center justify-center rounded-[6px] border border-danger bg-surface px-4 py-2 text-sm font-semibold text-danger-dark transition-colors hover:bg-danger-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2 motion-reduce:transition-none"
            >
              {retryLabel}
            </button>
          )}
          {secondaryAction}
        </div>
      </div>
    )
  }

  return (
    <div
      role="alert"
      className={`${className} rounded-[10px] border border-line bg-surface p-8 text-center`}
    >
      {showIcon && <AlertIcon tone={iconTone} />}
      <h2 className="mt-4 text-lg font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">{description}</p>
      {(onRetry || secondaryAction) && (
        <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center justify-center rounded-[8px] bg-pine px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none"
            >
              {retryLabel}
            </button>
          )}
          {secondaryAction}
        </div>
      )}
    </div>
  )
}

interface EmptyPanelProps {
  title: string
  description: ReactNode
  action?: ReactNode
  icon?: 'none' | 'list'
  titleAs?: 'h2' | 'p'
  compact?: boolean
  className?: string
  paddingClassName?: string
}

function EmptyListIcon() {
  return (
    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[10px] bg-pine-soft text-pine">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="h-6 w-6"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
      </svg>
    </div>
  )
}

/** Panel kosong bersama dengan aksi opsional. */
export function EmptyPanel({
  title,
  description,
  action,
  icon = 'none',
  titleAs = 'h2',
  compact = false,
  className = 'mt-6',
  paddingClassName = 'px-6 py-12',
}: EmptyPanelProps) {
  const Title = titleAs
  const hasIcon = icon !== 'none'

  const titleClassName = compact
    ? 'text-sm font-semibold text-ink'
    : hasIcon
      ? 'mt-4 text-lg font-semibold text-ink'
      : 'text-base font-semibold text-ink'

  return (
    <div
      className={`${className} rounded-[10px] border border-dashed border-line bg-surface text-center ${paddingClassName}`}
    >
      {hasIcon && <EmptyListIcon />}
      <Title className={titleClassName}>{title}</Title>
      <p
        className={
          compact
            ? 'mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted'
            : 'mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted'
        }
      >
        {description}
      </p>
      {action && <div className={compact ? 'mt-4' : 'mt-5'}>{action}</div>}
    </div>
  )
}
