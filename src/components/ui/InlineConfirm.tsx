import { useEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'

interface InlineConfirmProps {
  id: string
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  className?: string
}

/**
 * Konfirmasi inline yang dapat dioperasikan keyboard dan dibacakan screen
 * reader. Fokus dipindahkan ke tombol Batal saat panel muncul, Escape
 * membatalkan, dan fokus dikembalikan ke pemicu ketika panel ditutup.
 */
export default function InlineConfirm({
  id,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Batal',
  onConfirm,
  onCancel,
  className,
}: InlineConfirmProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    cancelRef.current?.focus()

    return () => {
      const previous = previousFocusRef.current
      if (previous?.isConnected) previous.focus()
    }
  }, [])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onCancel()
      return
    }

    if (event.key !== 'Tab') return

    const focusable =
      containerRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])')
    if (!focusable || focusable.length === 0) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      ref={containerRef}
      id={id}
      role="alertdialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      onKeyDown={handleKeyDown}
      className={className ?? 'rounded-[6px] border border-danger bg-danger-soft p-3'}
    >
      <p id={`${id}-title`} className="text-xs font-semibold text-danger-dark">
        {title}
      </p>
      <p id={`${id}-description`} className="mt-1 text-[11px] leading-relaxed text-danger-dark">
        {description}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="inline-flex items-center justify-center rounded-[4px] bg-danger px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-danger-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2 motion-reduce:transition-none"
        >
          {confirmLabel}
        </button>
        <button
          ref={cancelRef}
          type="button"
          onClick={onCancel}
          className="inline-flex items-center justify-center rounded-[4px] border border-line bg-surface px-3 py-1.5 text-[11px] font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 motion-reduce:transition-none"
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  )
}
