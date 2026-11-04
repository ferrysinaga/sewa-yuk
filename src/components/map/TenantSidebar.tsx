import { useBoothStore } from '../../store/useBoothStore'
import type { BoothCategory, BoothStatus } from '../../types/booth'

const categoryFilters: { value: BoothCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'F&B', label: 'F&B' },
  { value: 'Tech', label: 'Teknologi' },
  { value: 'Apparel', label: 'Pakaian' },
]

const categoryLabel: Record<BoothCategory, string> = {
  Tech: 'Teknologi',
  'F&B': 'F&B',
  Apparel: 'Pakaian',
}

const statusLabel: Record<BoothStatus, string> = {
  Available: 'Tersedia',
  Reserved: 'Dipesan',
  Booked: 'Terisi',
}

const statusBadgeClass: Record<BoothStatus, string> = {
  Available: 'border border-line bg-pine-soft text-pine',
  Reserved: 'border border-dashed border-muted bg-unavailable text-ink',
  Booked: 'border border-line bg-unavailable-deep text-ink',
}

const statusExplanation: Record<Exclude<BoothStatus, 'Available'>, string> = {
  Reserved: 'Booth ini sedang ditahan untuk penyewa lain dan belum bisa dipesan.',
  Booked: 'Booth ini sudah terisi. Pilih booth bertanda tersedia untuk melanjutkan.',
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(price)

interface TenantSidebarProps {
  activeCategory: BoothCategory | 'all'
  onCategoryChange: (category: BoothCategory | 'all') => void
  onReserve: () => void
  reserving: boolean
  reservedBoothId: string | null
}

export default function TenantSidebar({
  activeCategory,
  onCategoryChange,
  onReserve,
  reserving,
  reservedBoothId,
}: TenantSidebarProps) {
  const booths = useBoothStore((state) => state.booths)
  const activeBoothId = useBoothStore((state) => state.activeBoothId)
  const activeBooth = booths.find((booth) => booth.id === activeBoothId) ?? null

  const isAvailable = activeBooth?.status === 'Available'
  const isReservedByUser = Boolean(activeBooth && activeBooth.id === reservedBoothId)

  return (
    <aside className="w-full space-y-4 lg:sticky lg:top-20">
      <div className="rounded-[10px] border border-line bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink">Filter kategori</h2>
          <span className="text-xs tabular-nums text-muted">{booths.length} booth</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {categoryFilters.map((filter) => {
            const isActive = activeCategory === filter.value
            const count =
              filter.value === 'all'
                ? booths.length
                : booths.filter((booth) => booth.category === filter.value).length

            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => onCategoryChange(filter.value)}
                aria-pressed={isActive}
                className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-[6px] border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none ${
                  isActive
                    ? 'border-pine bg-pine text-white'
                    : 'border-line bg-surface text-muted hover:border-pine hover:text-pine'
                }`}
              >
                {filter.label}
                <span
                  className={`rounded-[3px] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                    isActive ? 'bg-pine-dark text-white' : 'bg-canvas text-muted'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-[10px] border border-line bg-surface p-5" aria-live="polite">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink">Detail booth</h2>
          {activeBooth && (
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted">Pilihan Anda</span>
          )}
        </div>

        {activeBooth ? (
          <div className="mt-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-lg font-semibold text-ink">
                  {categoryLabel[activeBooth.category]}
                </p>
                <p className="text-xs tabular-nums text-muted">
                  Booth {activeBooth.id.slice(0, 8)}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-[4px] px-2.5 py-1 text-[11px] font-semibold ${statusBadgeClass[activeBooth.status]}`}
              >
                {statusLabel[activeBooth.status]}
              </span>
            </div>

            <div className="mt-4 rounded-[6px] border border-line bg-canvas p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                Harga sewa
              </p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums tracking-tight text-ink">
                {formatPrice(activeBooth.price)}
              </p>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-[6px] border border-line p-2.5">
                <dt className="text-[10px] uppercase tracking-[0.1em] text-muted">Dimensi</dt>
                <dd className="mt-0.5 font-semibold tabular-nums text-ink">
                  {activeBooth.width} × {activeBooth.height} px
                </dd>
              </div>
              <div className="rounded-[6px] border border-line p-2.5">
                <dt className="text-[10px] uppercase tracking-[0.1em] text-muted">Kategori</dt>
                <dd className="mt-0.5 font-semibold text-ink">
                  {categoryLabel[activeBooth.category]}
                </dd>
              </div>
              <div className="rounded-[6px] border border-line p-2.5">
                <dt className="text-[10px] uppercase tracking-[0.1em] text-muted">Posisi X</dt>
                <dd className="mt-0.5 font-semibold tabular-nums text-ink">
                  {Math.round(activeBooth.positionX)} px
                </dd>
              </div>
              <div className="rounded-[6px] border border-line p-2.5">
                <dt className="text-[10px] uppercase tracking-[0.1em] text-muted">Posisi Y</dt>
                <dd className="mt-0.5 font-semibold tabular-nums text-ink">
                  {Math.round(activeBooth.positionY)} px
                </dd>
              </div>
            </dl>

            {!isAvailable && (
              <p className="mt-3 rounded-[6px] border border-line bg-unavailable px-3 py-2 text-xs leading-relaxed text-ink">
                {statusExplanation[activeBooth.status as Exclude<BoothStatus, 'Available'>]}
              </p>
            )}

            <button
              type="button"
              onClick={onReserve}
              disabled={!isAvailable || reserving || isReservedByUser}
              className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[6px] px-5 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed motion-reduce:transition-none ${
                isAvailable && !isReservedByUser
                  ? 'bg-pine text-white hover:bg-pine-dark disabled:opacity-70'
                  : 'border border-line bg-canvas text-muted'
              } ${isReservedByUser ? 'border-pine bg-pine-soft text-pine' : ''}`}
            >
              {reserving ? (
                <>
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  />
                  Memproses…
                </>
              ) : isReservedByUser ? (
                'Menunggu pembayaran'
              ) : !isAvailable ? (
                'Booth tidak tersedia'
              ) : (
                'Pesan booth ini'
              )}
            </button>

            <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-muted">
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted">
                <path
                  fillRule="evenodd"
                  d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z"
                  clipRule="evenodd"
                />
              </svg>
              Status booth dikunci otomatis begitu Anda melanjutkan, sehingga tidak bisa diambil
              penyewa lain.
            </p>
          </div>
        ) : (
          <div className="mt-3 rounded-[8px] border border-dashed border-line bg-canvas px-4 py-8 text-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
              className="mx-auto h-7 w-7 text-muted"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
            </svg>
            <p className="mt-2 text-sm font-semibold text-ink">Belum ada booth dipilih</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Klik salah satu booth pada peta untuk melihat detail harga dan spesifikasi.
            </p>
          </div>
        )}
      </div>
    </aside>
  )
}
