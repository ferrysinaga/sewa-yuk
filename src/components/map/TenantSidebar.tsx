import { useBoothStore } from '../../store/useBoothStore'
import type { BoothCategory, BoothStatus } from '../../types/booth'

const categoryFilters: { value: BoothCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'F&B', label: 'F&B' },
  { value: 'Tech', label: 'Tech' },
  { value: 'Apparel', label: 'Apparel' },
]

const statusLabel: Record<BoothStatus, string> = {
  Available: 'Tersedia',
  Reserved: 'Dipesan',
  Booked: 'Terisi',
}

const statusBadgeClass: Record<BoothStatus, string> = {
  Available: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  Reserved: 'bg-gray-100 text-gray-600 ring-gray-200',
  Booked: 'bg-gray-100 text-gray-600 ring-gray-200',
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

  return (
    <aside className="w-full space-y-4 lg:sticky lg:top-20">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-900">Filter Kategori</h2>
          <span className="text-xs text-gray-500">{booths.length} booth</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
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
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
                  isActive
                    ? 'bg-blue-600 text-white ring-blue-600'
                    : 'bg-white text-gray-600 ring-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {filter.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-md" aria-live="polite">
        <h2 className="text-sm font-semibold text-gray-900">Detail Booth</h2>

        {activeBooth ? (
          <div className="mt-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-gray-900">{activeBooth.category}</p>
                <p className="text-xs text-gray-500">Booth {activeBooth.id.slice(0, 8)}</p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${statusBadgeClass[activeBooth.status]}`}
              >
                {statusLabel[activeBooth.status]}
              </span>
            </div>

            <div className="mt-4 rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Harga sewa</p>
              <p className="mt-0.5 text-xl font-semibold tracking-tight text-gray-900">
                {formatPrice(activeBooth.price)}
              </p>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-gray-200 p-2.5">
                <dt className="text-gray-500">Dimensi</dt>
                <dd className="mt-0.5 font-semibold text-gray-900">
                  {activeBooth.width} × {activeBooth.height} px
                </dd>
              </div>
              <div className="rounded-lg border border-gray-200 p-2.5">
                <dt className="text-gray-500">Kategori</dt>
                <dd className="mt-0.5 font-semibold text-gray-900">{activeBooth.category}</dd>
              </div>
              <div className="rounded-lg border border-gray-200 p-2.5">
                <dt className="text-gray-500">Posisi X</dt>
                <dd className="mt-0.5 font-semibold text-gray-900">{Math.round(activeBooth.positionX)} px</dd>
              </div>
              <div className="rounded-lg border border-gray-200 p-2.5">
                <dt className="text-gray-500">Posisi Y</dt>
                <dd className="mt-0.5 font-semibold text-gray-900">{Math.round(activeBooth.positionY)} px</dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={onReserve}
              disabled={!isAvailable || reserving}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {reserving ? (
                <>
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  />
                  Memproses…
                </>
              ) : activeBooth.id === reservedBoothId ? (
                'Menunggu Pembayaran'
              ) : !isAvailable ? (
                'Booth Tidak Tersedia'
              ) : (
                'Pesan Sekarang'
              )}
            </button>

            <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-gray-500">
              <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400">
                <path
                  fillRule="evenodd"
                  d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z"
                  clipRule="evenodd"
                />
              </svg>
              Status booth dikunci otomatis begitu Anda melanjutkan, sehingga tidak bisa diambil penyewa
              lain.
            </p>
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-dashed border-gray-300 bg-gray-50/60 px-4 py-8 text-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              className="mx-auto h-7 w-7 text-gray-400"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
            </svg>
            <p className="mt-2 text-sm font-semibold text-gray-900">Belum ada booth dipilih</p>
            <p className="mt-1 text-xs text-gray-500">
              Klik salah satu booth pada peta untuk melihat detail harga dan spesifikasi.
            </p>
          </div>
        )}
      </div>
    </aside>
  )
}
