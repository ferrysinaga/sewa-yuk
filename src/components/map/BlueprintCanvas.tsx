import { memo } from 'react'
import type { RefObject } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { useBoothStore } from '../../store/useBoothStore'
import type { Booth } from '../../types/booth'

const CANVAS_WIDTH = 1000
const CANVAS_HEIGHT = 640
const GRID_SIZE = 20

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

  return (
    <g
      ref={setBoothRef}
      {...listeners}
      {...attributes}
      onClick={() => setActiveBooth(booth.id)}
      aria-pressed={isSelected}
      aria-label={`Booth ${booth.category}, ${formatPrice(booth.price)}`}
      className={`touch-none focus-visible:outline-none ${isDragging ? 'opacity-80' : ''} ${
        isSelected ? 'cursor-grabbing' : 'cursor-grab'
      }`}
    >
      <rect
        x={booth.positionX}
        y={booth.positionY}
        width={booth.width}
        height={booth.height}
        rx="8"
        strokeWidth={isSelected ? 2 : 1.2}
        className={
          isSelected
            ? 'fill-blue-600 stroke-blue-700'
            : isUnavailable
              ? 'fill-gray-100 stroke-gray-300'
              : 'fill-white stroke-gray-300 transition-colors hover:fill-blue-50 hover:stroke-blue-400'
        }
      />

      <text
        x={booth.positionX + 12}
        y={booth.positionY + 22}
        className={`pointer-events-none text-[11px] font-semibold ${
          isSelected ? 'fill-white' : isUnavailable ? 'fill-gray-600' : 'fill-gray-900'
        }`}
      >
        {booth.category}
      </text>

      <text
        x={booth.positionX + 12}
        y={booth.positionY + 38}
        className={`pointer-events-none text-[9px] font-medium ${
          isSelected ? 'fill-blue-50' : 'fill-gray-500'
        }`}
      >
        {booth.width} × {booth.height} px
      </text>

      {!isUnavailable && (
        <text
          x={booth.positionX + 12}
          y={booth.positionY + booth.height - 12}
          className={`pointer-events-none text-[9px] font-medium ${
            isSelected ? 'fill-white' : 'fill-gray-500'
          }`}
        >
          {formatPrice(booth.price)}
        </text>
      )}
    </g>
  )
})

interface BlueprintCanvasProps {
  setNodeRef: (element: HTMLElement | null) => void
  isOver: boolean
  svgRef: RefObject<SVGSVGElement | null>
}

export default function BlueprintCanvas({ setNodeRef, isOver, svgRef }: BlueprintCanvasProps) {
  const booths = useBoothStore((state) => state.booths)
  const setActiveBooth = useBoothStore((state) => state.setActiveBooth)

  return (
    <div className="min-w-0 flex-1">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Kanvas Blueprint</h2>
            <p className="text-xs text-gray-500">
              Hall A · {booths.length} booth · grid {GRID_SIZE} px
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded border border-gray-300 bg-white" /> Tersedia
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded border border-blue-700 bg-blue-600" /> Dipilih
            </span>
          </div>
        </div>

        <div
          ref={setNodeRef}
          className={`p-4 transition-colors sm:p-5 ${isOver ? 'bg-blue-50/60' : 'bg-gray-50/70'}`}
        >
          <div
            className={`relative overflow-hidden rounded-xl border bg-white transition-colors ${
              isOver ? 'border-blue-300' : 'border-gray-200'
            }`}
          >
            <svg
              ref={svgRef}
              viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
              role="img"
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
                    stroke="#e5e7eb"
                    strokeWidth="1"
                  />
                </pattern>
              </defs>

              <rect
                x="0"
                y="0"
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                fill="white"
                onClick={() => setActiveBooth(null)}
              />
              <rect
                x="0"
                y="0"
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                fill="url(#blueprint-grid)"
                opacity="0.8"
                onClick={() => setActiveBooth(null)}
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

              {booths.map((booth) => (
                <BoothRect key={booth.id} booth={booth} />
              ))}
            </svg>

            {booths.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                <div className="rounded-2xl border border-dashed border-gray-300 bg-white/90 px-6 py-5 text-center shadow-sm">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="h-5 w-5"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-gray-900">Kanvas masih kosong</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Tarik kategori booth dari panel kiri ke area ini.
                  </p>
                </div>
              </div>
            )}
          </div>

          <p className="mt-3 text-center text-xs text-gray-500">
            Geser booth untuk mengubah posisi. Posisi otomatis menempel pada grid {GRID_SIZE} px.
          </p>
        </div>
      </div>
    </div>
  )
}
