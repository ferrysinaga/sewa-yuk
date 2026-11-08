import {
  BOOTH_CATEGORY_LABEL as categoryLabel,
  BOOTH_STATUS_LABEL as statusLabel,
  formatPrice,
} from '../../lib/boothDisplay'
import { MAP_HEIGHT, MAP_WIDTH, booths } from './landingContent'
import type { Booth, Category } from './landingContent'

interface BoothMapCanvasProps {
  viewBox: string
  activeBooth: Booth | null
  category: Category | 'all'
  onSelectBooth: (id: string) => void
  onClearSelection: () => void
}

export default function BoothMapCanvas({
  viewBox,
  activeBooth,
  category,
  onSelectBooth,
  onClearSelection,
}: BoothMapCanvasProps) {
  return (
    <div className="bg-map p-3 sm:p-4">
      <div
        tabIndex={0}
        role="group"
        aria-label="Area denah yang dapat digeser"
        className="overflow-x-auto overscroll-x-contain rounded-[8px] border border-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine"
      >
        <div className="min-w-[520px]">
          <svg
            viewBox={viewBox}
            role="group"
            aria-label="Pratinjau denah booth Hall A"
            aria-describedby="peta-hint"
            className="block h-auto w-full select-none"
          >
            <defs>
              <pattern id="landing-booth-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--color-grid)" strokeWidth="1" />
              </pattern>
            </defs>

            <rect
              x="0"
              y="0"
              width={MAP_WIDTH}
              height={MAP_HEIGHT}
              fill="var(--color-map)"
              onClick={onClearSelection}
            />
            <rect
              x="0"
              y="0"
              width={MAP_WIDTH}
              height={MAP_HEIGHT}
              fill="url(#landing-booth-grid)"
              pointerEvents="none"
            />
            <rect
              x="0.5"
              y="0.5"
              width={MAP_WIDTH - 1}
              height={MAP_HEIGHT - 1}
              fill="none"
              stroke="var(--color-line)"
              pointerEvents="none"
            />

            <text
              x={MAP_WIDTH / 2}
              y="34"
              textAnchor="middle"
              className="pointer-events-none fill-muted text-[10px] font-semibold tracking-[0.28em]"
            >
              HALL A
            </text>
            <text
              x="222"
              y="200"
              textAnchor="middle"
              transform="rotate(-90 222 200)"
              className="pointer-events-none fill-muted text-[10px] font-medium tracking-[0.3em] opacity-60"
            >
              LORONG UTAMA
            </text>

            {booths.map((booth) => {
              const isSelected = booth.id === activeBooth?.id
              const isUnavailable = booth.status !== 'Available'
              const isDimmed = category !== 'all' && booth.category !== category
              const isReserved = booth.status === 'Reserved'
              const rectTone = isUnavailable
                ? isSelected
                  ? isReserved
                    ? 'fill-unavailable stroke-pine-dark'
                    : 'fill-unavailable-deep stroke-pine-dark'
                  : isReserved
                    ? 'fill-unavailable stroke-muted'
                    : 'fill-unavailable-deep stroke-muted'
                : isSelected
                  ? 'fill-pine stroke-pine-dark'
                  : 'fill-surface stroke-pine hover:fill-pine-soft hover:stroke-pine-dark'

              const titleTone = isSelected && !isUnavailable ? 'fill-white' : 'fill-ink'
              const metaTone = isSelected && !isUnavailable ? 'fill-pine-soft' : 'fill-muted'
              const priceTone =
                isSelected && !isUnavailable ? 'fill-white' : isUnavailable ? 'fill-muted' : 'fill-ink'

              return (
                <g
                  key={booth.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  aria-label={`${booth.label} ${categoryLabel[booth.category]} · ${statusLabel[booth.status]} ${formatPrice(
                    booth.price,
                  )} ${booth.size} ${booth.note}`}
                  onClick={() => onSelectBooth(booth.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onSelectBooth(booth.id)
                    }
                    if (event.key === 'Escape') {
                      onClearSelection()
                    }
                  }}
                  className={`group cursor-pointer outline-none transition-opacity focus-visible:outline-none motion-reduce:transition-none ${
                    isDimmed ? 'opacity-30' : 'opacity-100'
                  }`}
                >
                  <title>{`${booth.label} — ${statusLabel[booth.status]}`}</title>

                  <rect
                    x={booth.x}
                    y={booth.y}
                    width={booth.width}
                    height={booth.height}
                    rx="8"
                    strokeWidth={isSelected ? 2.4 : 1.4}
                    strokeDasharray={isReserved ? '4 3' : undefined}
                    className={`transition-colors motion-reduce:transition-none ${rectTone}`}
                  />

                  <rect
                    x={booth.x - 3}
                    y={booth.y - 3}
                    width={booth.width + 6}
                    height={booth.height + 6}
                    rx="10"
                    fill="none"
                    stroke="var(--color-clay)"
                    strokeWidth="2"
                    strokeDasharray="4 3"
                    className="pointer-events-none opacity-0 transition-opacity group-focus-visible:opacity-100 motion-reduce:transition-none"
                  />

                  <text
                    x={booth.x + 12}
                    y={booth.y + 24}
                    className={`pointer-events-none text-[11px] font-semibold ${titleTone}`}
                  >
                    {booth.id}
                  </text>
                  {' '}
                  <text
                    x={booth.x + 12}
                    y={booth.y + 40}
                    className={`pointer-events-none text-[9px] font-medium ${metaTone}`}
                  >
                    {categoryLabel[booth.category]} · {statusLabel[booth.status]}
                  </text>
                  {' '}
                  <text
                    x={booth.x + 12}
                    y={booth.y + booth.height - 12}
                    className={`pointer-events-none text-[10px] font-medium tabular-nums ${priceTone}`}
                  >
                    {formatPrice(booth.price)}
                  </text>

                  {isSelected && (
                    <g
                      transform={`translate(${booth.x + booth.width - 14} ${booth.y + 14})`}
                      className="pointer-events-none"
                    >
                      <circle r="7" fill="var(--color-surface)" />
                      <path
                        d="M-3 0.5 0 3.5 4 -3"
                        fill="none"
                        stroke="var(--color-pine)"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>
                  )}
                </g>
              )
            })}

            <path d="M220 384h80" stroke="var(--color-line)" strokeWidth="4" strokeLinecap="round" />
            <path
              d="M256 372v12"
              stroke="var(--color-line)"
              strokeWidth="2"
              strokeDasharray="3 3"
            />
            <text
              x="260"
              y="368"
              textAnchor="middle"
              className="pointer-events-none fill-muted text-[9px] font-semibold tracking-[0.2em]"
            >
              PINTU MASUK
            </text>
          </svg>
        </div>
      </div>

      <p className="mt-2 text-[11px] text-muted sm:hidden">
        Geser denah ke samping untuk melihat seluruh area.
      </p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-medium text-muted">
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[2px] border border-pine bg-surface" />
            Tersedia
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[2px] bg-pine" />
            Dipilih
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-[2px] border border-dashed border-muted bg-unavailable"
            />
            Dipesan
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-[2px] border border-muted bg-unavailable-deep"
            />
            Terisi
          </li>
        </ul>
        <p id="peta-hint" className="text-[11px] text-muted">
          Pilih booth untuk melihat detail.
        </p>
      </div>
    </div>
  )
}
