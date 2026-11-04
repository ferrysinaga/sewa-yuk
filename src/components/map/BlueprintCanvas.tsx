import { memo } from 'react'
import type { RefObject } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useBoothStore } from '../../store/useBoothStore'
import type { Booth, BoothStatus } from '../../types/booth'

const CANVAS_WIDTH = 1000
const CANVAS_HEIGHT = 640
const GRID_SIZE = 20

const statusLabel: Record<BoothStatus, string> = {
  Available: 'Tersedia',
  Reserved: 'Dipesan',
  Booked: 'Terisi',
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(price)

interface BoothRectProps {
  booth: Booth
}

const BoothRect = memo(function BoothRect({ booth }: BoothRectProps) {
  const isSelected = useBoothStore((state) => state.activeBoothId === booth.id)
  const setActiveBooth = useBoothStore((state) => state.setActiveBooth)
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `booth-${booth.id}`,
    data: { type: 'booth', boothId: booth.id },
  })

  const isUnavailable = booth.status !== 'Available'

  const setBoothRef = (element: SVGGElement | null) => {
    setNodeRef(element as unknown as HTMLElement | null)
  }

  const rectTone = isSelected
    ? 'fill-pine stroke-pine-dark'
    : isUnavailable
      ? booth.status === 'Reserved'
        ? 'fill-unavailable stroke-muted'
        : 'fill-unavailable-deep stroke-muted'
      : 'fill-surface stroke-pine hover:fill-pine-soft hover:stroke-pine-dark'

  return (
    <g
      ref={setBoothRef}
      {...listeners}
      {...attributes}
      onClick={() => setActiveBooth(booth.id)}
      aria-pressed={isSelected}
      aria-label={`Booth ${booth.category}, ${formatPrice(booth.price)}, status ${statusLabel[booth.status]}`}
      className={`group touch-none focus-visible:outline-none ${isDragging ? 'opacity-80' : ''} ${
        isSelected ? 'cursor-grabbing' : 'cursor-grab'
      }`}
    >
      <rect
        x={booth.positionX}
        y={booth.positionY}
        width={booth.width}
        height={booth.height}
        rx="8"
        strokeWidth={isSelected ? 2.4 : 1.4}
        strokeDasharray={booth.status === 'Reserved' ? '4 3' : undefined}
        className={`transition-colors motion-reduce:transition-none ${rectTone}`}
      />

      <rect
        x={booth.positionX - 3}
        y={booth.positionY - 3}
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
        x={booth.positionX + 12}
        y={booth.positionY + 22}
        className={`pointer-events-none text-[11px] font-semibold ${
          isSelected ? 'fill-white' : 'fill-ink'
        }`}
      >
        {booth.category}
      </text>

      <text
        x={booth.positionX + 12}
        y={booth.positionY + 38}
        className={`pointer-events-none text-[9px] font-medium ${
          isSelected ? 'fill-pine-soft' : 'fill-muted'
        }`}
      >
        {booth.width} × {booth.height} px · {statusLabel[booth.status]}
      </text>

      <text
        x={booth.positionX + 12}
        y={booth.positionY + booth.height - 12}
        className={`pointer-events-none text-[9px] font-medium tabular-nums ${
          isSelected ? 'fill-white' : isUnavailable ? 'fill-muted' : 'fill-ink'
        }`}
      >
        {formatPrice(booth.price)}
      </text>
    </g>
  )
})

interface BlueprintCanvasProps {
  svgRef: RefObject<SVGSVGElement | null>
}

export default function BlueprintCanvas({ svgRef }: BlueprintCanvasProps) {
  const booths = useBoothStore((state) => state.booths)
  const blueprintImageUrl = useBoothStore((state) => state.blueprintImageUrl)
  const setActiveBooth = useBoothStore((state) => state.setActiveBooth)
  // `useDroppable` harus dipanggil dari komponen yang benar-benar berada di dalam
  // <DndContext>. Memanggilnya di komponen yang merender <DndContext> membuat
  // hook tersebut membaca context default (no-op) sehingga drop tidak pernah terdeteksi.
  const { setNodeRef, isOver } = useDroppable({ id: 'blueprint-canvas' })

  return (
    <div className="min-w-0 flex-1">
      <div className="overflow-hidden rounded-[10px] border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-sm font-semibold text-ink">Kanvas blueprint</h2>
            <p className="text-xs tabular-nums text-muted">
              Hall A · {booths.length} booth · grid {GRID_SIZE} px
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted">
            {blueprintImageUrl && (
              <span className="inline-flex items-center gap-1.5 text-pine">
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[2px] border border-pine bg-pine-soft" />
                Gambar latar aktif
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[2px] border border-pine bg-surface" />
              Tersedia
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[2px] bg-pine" />
              Dipilih
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[2px] border border-muted bg-unavailable" />
              Tidak tersedia
            </span>
          </div>
        </div>

        <div
          ref={setNodeRef}
          className={`p-4 transition-colors sm:p-5 motion-reduce:transition-none ${
            isOver ? 'bg-pine-soft' : 'bg-map'
          }`}
        >
          <div
            className={`relative overflow-hidden rounded-[8px] border bg-map transition-colors motion-reduce:transition-none ${
              isOver ? 'border-pine' : 'border-line'
            }`}
          >
            <svg
              ref={svgRef}
              viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
              role="group"
              aria-label="Kanvas blueprint untuk menempatkan booth"
              className="h-auto w-full touch-none select-none"
              onClick={(event) => {
                if (event.target === event.currentTarget) setActiveBooth(null)
              }}
            >
              <defs>
                <pattern
                  id="blueprint-grid"
                  width={GRID_SIZE}
                  height={GRID_SIZE}
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`}
                    fill="none"
                    stroke="var(--color-grid)"
                    strokeWidth="1"
                  />
                </pattern>
              </defs>

              <rect
                x="0"
                y="0"
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                fill="var(--color-map)"
                onClick={() => setActiveBooth(null)}
              />

              {blueprintImageUrl && (
                <image
                  href={blueprintImageUrl}
                  x="0"
                  y="0"
                  width={CANVAS_WIDTH}
                  height={CANVAS_HEIGHT}
                  preserveAspectRatio="xMidYMid meet"
                  opacity="0.92"
                  className="pointer-events-none"
                  aria-hidden="true"
                />
              )}
              <rect
                x="0"
                y="0"
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                fill="url(#blueprint-grid)"
                opacity={blueprintImageUrl ? '0.35' : '0.8'}
                onClick={() => setActiveBooth(null)}
              />

              {!blueprintImageUrl && (
                <text
                  x={CANVAS_WIDTH / 2}
                  y="32"
                  textAnchor="middle"
                  className="pointer-events-none fill-muted text-[11px] font-semibold tracking-[0.3em]"
                >
                  AREA PAMERAN
                </text>
              )}

              {!blueprintImageUrl && (
                <text
                  x={CANVAS_WIDTH / 2}
                  y={CANVAS_HEIGHT - 20}
                  textAnchor="middle"
                  className="pointer-events-none fill-muted text-[11px] font-semibold tracking-[0.3em]"
                >
                  PINTU MASUK
                </text>
              )}

              {booths.map((booth) => (
                <BoothRect key={booth.id} booth={booth} />
              ))}
            </svg>

            {booths.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                <div className="rounded-[8px] border border-line bg-surface px-6 py-5 text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-[6px] bg-pine-soft text-pine">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      aria-hidden="true"
                      className="h-5 w-5"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-ink">Kanvas masih kosong</p>
                  <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted">
                    Tarik kategori booth dari panel kiri ke area ini.
                  </p>
                </div>
              </div>
            )}
          </div>

          <p className="mt-3 text-center text-xs leading-relaxed text-muted">
            Geser booth untuk mengubah posisi. Posisi otomatis menempel pada grid {GRID_SIZE} px.
          </p>
        </div>
      </div>
    </div>
  )
}
