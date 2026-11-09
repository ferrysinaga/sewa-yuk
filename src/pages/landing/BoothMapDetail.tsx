import { Link } from 'react-router-dom'
import {
  BOOTH_CATEGORY_LABEL as categoryLabel,
  BOOTH_STATUS_LABEL as statusLabel,
  formatPrice,
} from '../../lib/boothDisplay'
import { ArrowRight, StatusBadge } from './LandingIcons'
import type { Booth } from './landingContent'

interface BoothMapDetailProps {
  activeBooth: Booth | null
  onClearSelection: () => void
}

export default function BoothMapDetail({ activeBooth, onClearSelection }: BoothMapDetailProps) {
  return (
    <div className="border-t border-line bg-surface px-4 py-4 sm:px-5">
      <p className="sr-only" aria-live="polite">
        {activeBooth
          ? `Booth ${activeBooth.id} dipilih. ${activeBooth.note}. Status ${
              statusLabel[activeBooth.status]
            }. Harga ${formatPrice(activeBooth.price)}.`
          : 'Tidak ada booth yang dipilih.'}
      </p>
      {activeBooth ? (
        <div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[6px] border border-line bg-canvas text-xs font-semibold tabular-nums text-pine">
                {activeBooth.id}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-ink">{activeBooth.label}</p>
                  <StatusBadge status={activeBooth.status} />
                </div>
                <p className="mt-1 text-xs tabular-nums text-muted">
                  {categoryLabel[activeBooth.category]} · {activeBooth.size} · Hall A
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{activeBooth.note}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-end justify-between gap-3 sm:justify-end">
              <div className="sm:text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                  Harga sewa
                </p>
                <p className="mt-0.5 text-base font-semibold tabular-nums text-ink">
                  {formatPrice(activeBooth.price)}
                </p>
              </div>
              {activeBooth.status === 'Available' ? (
                <Link
                  to="/event"
                  className="inline-flex items-center justify-center gap-2 rounded-[6px] bg-pine px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none"
                >
                  Pesan booth
                  <ArrowRight />
                </Link>
              ) : (
                <span className="inline-flex items-center rounded-[6px] border border-line bg-canvas px-3 py-2 text-xs font-medium text-muted">
                  Tidak dapat dipesan
                </span>
              )}
            </div>
          </div>

          {activeBooth.status !== 'Available' && (
            <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-muted">
              {activeBooth.status === 'Reserved'
                ? 'Booth ini sedang ditahan untuk penyewa lain.'
                : 'Booth ini sudah terisi.'}{' '}
              Pilih booth bertanda tersedia untuk melanjutkan.
            </p>
          )}

          <button
            type="button"
            onClick={onClearSelection}
            className="mt-3 text-xs font-semibold text-muted underline decoration-line underline-offset-4 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none"
          >
            Tutup detail
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            Pilih salah satu booth pada denah untuk melihat ukuran, harga, dan statusnya.
          </p>
          <Link
            to="/event"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-pine transition-colors hover:text-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none"
          >
            Lihat semua booth
            <ArrowRight />
          </Link>
        </div>
      )}
    </div>
  )
}
