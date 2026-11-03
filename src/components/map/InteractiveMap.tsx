import { useBoothStore } from '../../store/useBoothStore'
import type { BoothCategory } from '../../types/booth'

const CANVAS_WIDTH = 1000
const CANVAS_HEIGHT = 640
const GRID_SIZE = 20

const formatPrice = (price: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(price)

interface InteractiveMapProps {
  activeCategory: BoothCategory | 'all'
}

export default function InteractiveMap({ activeCategory }: InteractiveMapProps) {
  const booths = useBoothStore((state) => state.booths)
  const activeBoothId = useBoothStore((state) => state.activeBoothId)
  const setActiveBooth = useBoothStore((state) => state.setActiveBooth)

  const availableCount = booths.filter((booth) => booth.status === 'Available').length

  return (
    <div className="min-w-0 rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Peta Booth</h2>
          <p className="text-xs text-gray-500">
            {availableCount} tersedia dari {booths.length} booth
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded border border-emerald-300 bg-emerald-50" /> Tersedia
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded border border-blue-700 bg-blue-600" /> Dipilih
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded border border-gray-300 bg-gray-100" /> Terisi
          </span>
        </div>
      </div>

      <div className="bg-gray-50/70 p-4 sm:p-5">
        <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white">
          <svg
            viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
            role="img"
            aria-label="Peta blueprint booth interaktif"
            className="h-auto w-full select-none"
            onClick={(event) => {
              if (event.target === event.currentTarget) setActiveBooth(null)
            }}
          >
            <defs>
              <pattern
                id="tenant-blueprint-grid"
                width={GRID_SIZE}
                height={GRID_SIZE}
                patternUnits="userSpaceOnUse"
              >
                <path
                  d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`}
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="1"
                />
              </pattern>
            </defs>

            <rect x="0" y="0" width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="white" />
            <rect
              x="0"
              y="0"
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              fill="url(#tenant-blueprint-grid)"
              opacity="0.8"
            />

            <text
              x={CANVAS_WIDTH / 2}
              y="32"
              textAnchor="middle"
              className="pointer-events-none fill-gray-300 text-[11px] font-semibold tracking-[0.3em]"
            >
              AREA PAMERAN
            </text>

            <text
              x={CANVAS_WIDTH / 2}
              y={CANVAS_HEIGHT - 20}
              textAnchor="middle"
              className="pointer-events-none fill-gray-300 text-[11px] font-semibold tracking-[0.3em]"
            >
              PINTU MASUK
            </text>

            {booths.map((booth) => {
              const isSelected = booth.id === activeBoothId
              const isUnavailable = booth.status !== 'Available'
              const isDimmed = activeCategory !== 'all' && booth.category !== activeCategory

              return (
                <g
                  key={booth.id}
                  role="button"
                  tabIndex={isUnavailable ? -1 : 0}
                  aria-pressed={isSelected}
                  aria-disabled={isUnavailable}
                  aria-label={`Booth ${booth.category}, ${formatPrice(booth.price)}, ${
                    isUnavailable ? 'tidak tersedia' : 'tersedia'
                  }`}
                  onKeyDown={(event) => {
                    if (!isUnavailable && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault()
                      setActiveBooth(booth.id)
                    }
                  }}
                  className={`transition-opacity focus-visible:outline-none ${
                    isDimmed ? 'opacity-25' : 'opacity-100'
                  } ${isUnavailable ? 'pointer-events-none cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <rect
                    x={booth.positionX}
                    y={booth.positionY}
                    width={booth.width}
                    height={booth.height}
                    rx="8"
                    strokeWidth={isSelected ? 2 : 1.2}
                    onClick={() => {
                      if (!isUnavailable) setActiveBooth(booth.id)
                    }}
                    className={
                      isUnavailable
                        ? 'fill-gray-100 stroke-gray-300'
                        : isSelected
                          ? 'fill-blue-600 stroke-blue-700'
                          : 'fill-emerald-50 stroke-emerald-300 transition-colors hover:fill-emerald-100 hover:stroke-emerald-400'
                    }
                  />

                  <text
                    x={booth.positionX + 12}
                    y={booth.positionY + 22}
                    className={`pointer-events-none text-[11px] font-semibold ${
                      isUnavailable ? 'fill-gray-400' : isSelected ? 'fill-white' : 'fill-gray-900'
                    }`}
                  >
                    {booth.category}
                  </text>

                  <text
                    x={booth.positionX + 12}
                    y={booth.positionY + 38}
                    className={`pointer-events-none text-[9px] font-medium ${
                      isUnavailable ? 'fill-gray-400' : isSelected ? 'fill-blue-100' : 'fill-emerald-700'
                    }`}
                  >
                    {isUnavailable ? 'Terisi' : 'Tersedia'}
                  </text>

                  {!isUnavailable && (
                    <text
                      x={booth.positionX + 12}
                      y={booth.positionY + booth.height - 12}
                      className={`pointer-events-none text-[9px] font-medium ${
                        isSelected ? 'fill-white' : 'fill-gray-600'
                      }`}
                    >
                      {formatPrice(booth.price)}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>

          {booths.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white/90 px-6 py-5 text-center shadow-sm">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-500">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                  </svg>
                </div>
                <p className="mt-3 text-sm font-semibold text-gray-900">Belum ada booth</p>
                <p className="mt-1 text-xs text-gray-500">
                  Penyelenggara belum menambahkan booth pada event ini.
                </p>
              </div>
            </div>
          )}
        </div>

        <p className="mt-3 text-center text-xs text-gray-500">
          Klik booth berwarna hijau untuk melihat detail, lalu kunci posisi Anda.
        </p>
      </div>
    </div>
  )
}
