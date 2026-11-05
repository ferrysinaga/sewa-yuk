import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useBoothStore } from '../../store/useBoothStore'
import type { BoothCategory, BoothStatus } from '../../types/booth'

const CANVAS_WIDTH = 1000
const CANVAS_HEIGHT = 640
const GRID_SIZE = 20
const MIN_SCALE = 1
const MAX_SCALE = 3

const formatPrice = (price: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(price)

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

interface Point {
  x: number
  y: number
}

interface ViewState {
  scale: number
  x: number
  y: number
}

interface Gesture {
  mode: 'pan' | 'pinch'
  startDistance: number
  startScale: number
  startOffset: Point
  startMid: Point
}

interface Size {
  width: number
  height: number
}

function clampScale(scale: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
}

function clampOffset(offset: Point, scale: number, size: Size): Point {
  if (size.width <= 0 || size.height <= 0) return { x: 0, y: 0 }

  const minX = size.width * (1 - scale)
  const minY = size.height * (1 - scale)

  return {
    x: Math.min(0, Math.max(minX, offset.x)),
    y: Math.min(0, Math.max(minY, offset.y)),
  }
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function distance(a: Point, b: Point) {
  return Math.max(Math.hypot(b.x - a.x, b.y - a.y), 1)
}

interface InteractiveMapProps {
  activeCategory: BoothCategory | 'all'
}

export default function InteractiveMap({ activeCategory }: InteractiveMapProps) {
  const booths = useBoothStore((state) => state.booths)
  const blueprintImageUrl = useBoothStore((state) => state.blueprintImageUrl)
  const activeBoothId = useBoothStore((state) => state.activeBoothId)
  const setActiveBooth = useBoothStore((state) => state.setActiveBooth)

  const [view, setView] = useState<ViewState>({ scale: 1, x: 0, y: 0 })
  const viewportRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef(view)
  const pointersRef = useRef<Map<number, Point>>(new Map())
  const gestureRef = useRef<Gesture | null>(null)
  const suppressClickRef = useRef(false)

  useEffect(() => {
    viewRef.current = view
  }, [view])

  const applyView = (updater: (previous: ViewState) => ViewState) => {
    setView((previous) => {
      const next = updater(previous)
      viewRef.current = next
      return next
    })
  }

  const getSize = (): Size => {
    const element = viewportRef.current
    return {
      width: element?.clientWidth ?? 0,
      height: element?.clientHeight ?? 0,
    }
  }

  useEffect(() => {
    const element = viewportRef.current
    if (!element) return

    const syncSize = () => {
      const size = { width: element.clientWidth, height: element.clientHeight }
      applyView((previous) => {
        if (previous.scale <= MIN_SCALE) return previous
        return { ...previous, ...clampOffset({ x: previous.x, y: previous.y }, previous.scale, size) }
      })
    }

    syncSize()

    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(syncSize)
    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const element = viewportRef.current
    if (!element) return

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return

      event.preventDefault()

      const rect = element.getBoundingClientRect()
      const focal = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      const current = viewRef.current
      const factor = Math.exp(-event.deltaY * 0.0015)
      const nextScale = clampScale(current.scale * factor)

      if (nextScale === current.scale) return

      const ratio = nextScale / current.scale
      const offset = {
        x: focal.x - (focal.x - current.x) * ratio,
        y: focal.y - (focal.y - current.y) * ratio,
      }
      const next = {
        scale: nextScale,
        ...clampOffset(offset, nextScale, {
          width: element.clientWidth,
          height: element.clientHeight,
        }),
      }

      viewRef.current = next
      setView(next)
    }

    element.addEventListener('wheel', handleWheel, { passive: false })

    return () => element.removeEventListener('wheel', handleWheel)
  }, [])

  const getPoint = (event: ReactPointerEvent<HTMLDivElement>): Point => {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return

    const point = getPoint(event)
    pointersRef.current.set(event.pointerId, point)
    suppressClickRef.current = false

    if (pointersRef.current.size === 1) {
      gestureRef.current = {
        mode: 'pan',
        startDistance: 0,
        startScale: viewRef.current.scale,
        startOffset: { x: viewRef.current.x, y: viewRef.current.y },
        startMid: point,
      }
      return
    }

    if (pointersRef.current.size === 2) {
      const [first, second] = Array.from(pointersRef.current.values())
      const mid = midpoint(first, second)
      const current = viewRef.current

      gestureRef.current = {
        mode: 'pinch',
        startDistance: distance(first, second),
        startScale: current.scale,
        startOffset: { x: current.x, y: current.y },
        startMid: mid,
      }
      suppressClickRef.current = true
    }
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointers = pointersRef.current
    if (!pointers.has(event.pointerId)) return

    const point = getPoint(event)
    pointers.set(event.pointerId, point)

    const gesture = gestureRef.current
    if (!gesture) return

    const element = viewportRef.current
    const size = getSize()

    if (pointers.size >= 2) {
      const [first, second] = Array.from(pointers.values())
      const mid = midpoint(first, second)
      const currentDistance = distance(first, second)

      if (gesture.mode !== 'pinch') {
        const current = viewRef.current
        gestureRef.current = {
          mode: 'pinch',
          startDistance: currentDistance,
          startScale: current.scale,
          startOffset: { x: current.x, y: current.y },
          startMid: mid,
        }
        suppressClickRef.current = true
        return
      }

      if (element) {
        pointers.forEach((_, pointerId) => {
          if (!element.hasPointerCapture(pointerId)) element.setPointerCapture(pointerId)
        })
      }

      suppressClickRef.current = true

      const nextScale = clampScale(gesture.startScale * (currentDistance / gesture.startDistance))
      const ratio = nextScale / gesture.startScale
      const offset = {
        x: gesture.startMid.x - (gesture.startMid.x - gesture.startOffset.x) * ratio,
        y: gesture.startMid.y - (gesture.startMid.y - gesture.startOffset.y) * ratio,
      }

      applyView(() => ({
        scale: nextScale,
        ...clampOffset(offset, nextScale, size),
      }))
      return
    }

    if (gesture.mode !== 'pan') return
    if (viewRef.current.scale <= MIN_SCALE) return

    const deltaX = point.x - gesture.startMid.x
    const deltaY = point.y - gesture.startMid.y

    if (Math.hypot(deltaX, deltaY) < 4) return

    if (element && !element.hasPointerCapture(event.pointerId)) {
      element.setPointerCapture(event.pointerId)
    }

    suppressClickRef.current = true
    applyView((previous) => ({
      ...previous,
      ...clampOffset(
        { x: gesture.startOffset.x + deltaX, y: gesture.startOffset.y + deltaY },
        previous.scale,
        size,
      ),
    }))
  }

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const element = viewportRef.current
    const pointers = pointersRef.current

    pointers.delete(event.pointerId)

    if (element && element.hasPointerCapture(event.pointerId)) {
      element.releasePointerCapture(event.pointerId)
    }

    if (pointers.size === 1) {
      const [point] = Array.from(pointers.values())
      const current = viewRef.current

      gestureRef.current = {
        mode: 'pan',
        startDistance: 0,
        startScale: current.scale,
        startOffset: { x: current.x, y: current.y },
        startMid: point,
      }
    } else {
      gestureRef.current = null
    }
  }

  const zoomBy = (factor: number) => {
    const size = getSize()
    const focal = { x: size.width / 2, y: size.height / 2 }

    applyView((previous) => {
      const nextScale = clampScale(previous.scale * factor)
      if (nextScale === previous.scale) return previous

      const ratio = nextScale / previous.scale
      const offset = {
        x: focal.x - (focal.x - previous.x) * ratio,
        y: focal.y - (focal.y - previous.y) * ratio,
      }

      return {
        scale: nextScale,
        ...clampOffset(offset, nextScale, size),
      }
    })
  }

  const resetView = () => {
    setView({ scale: 1, x: 0, y: 0 })
    viewRef.current = { scale: 1, x: 0, y: 0 }
  }

  const availableCount = booths.filter((booth) => booth.status === 'Available').length
  const isZoomed = view.scale > MIN_SCALE + 0.001
  const canZoomIn = view.scale < MAX_SCALE - 0.001
  const activeBooth = booths.find((booth) => booth.id === activeBoothId) ?? null

  return (
    <div className="min-w-0 overflow-hidden rounded-[10px] border border-line bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="h-1.5 w-1.5 bg-clay" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
              Peta booth
            </p>
          </div>
          <h2 className="mt-2 text-base font-semibold tracking-tight text-ink sm:text-lg">
            Denah interaktif
          </h2>
          <p className="mt-1 text-xs tabular-nums text-muted">
            {availableCount} tersedia dari {booths.length} booth
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {blueprintImageUrl && (
            <span className="inline-flex items-center gap-2 text-xs text-muted">
              <span aria-hidden="true" className="h-3 w-3 rounded border border-line bg-map" />
              Gambar denah
            </span>
          )}
          <div
            role="group"
            aria-label="Kontrol zoom peta"
            className="flex items-center gap-0.5 rounded-[6px] border border-line bg-surface p-0.5"
          >
          <button
            type="button"
            onClick={() => zoomBy(1.25)}
            disabled={!canZoomIn}
            aria-label="Perbesar peta"
            className="flex h-9 w-9 items-center justify-center rounded-[4px] text-ink transition-colors hover:bg-pine-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:w-8 motion-reduce:transition-none"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
              <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
            </svg>
          </button>
          <span className="px-1 text-[10px] font-semibold tabular-nums text-muted">
            {Math.round(view.scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => zoomBy(0.8)}
            disabled={!isZoomed}
            aria-label="Perkecil peta"
            className="flex h-9 w-9 items-center justify-center rounded-[4px] text-ink transition-colors hover:bg-pine-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:w-8 motion-reduce:transition-none"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
              <path d="M4 10a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H4.75A.75.75 0 0 1 4 10Z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={resetView}
            disabled={!isZoomed}
            aria-label="Reset zoom peta"
            className="flex h-9 w-9 items-center justify-center rounded-[4px] text-[10px] font-bold text-muted transition-colors hover:bg-pine-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:w-8 motion-reduce:transition-none"
          >
            1×
          </button>
        </div>
        </div>
      </div>

      <div className="bg-map p-3 sm:p-4">
        <div
          ref={viewportRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onClickCapture={(event) => {
            if (suppressClickRef.current) {
              event.preventDefault()
              event.stopPropagation()
              suppressClickRef.current = false
            }
          }}
          className={`relative overflow-hidden rounded-[8px] border border-line bg-map ${
            isZoomed ? 'touch-none cursor-grab active:cursor-grabbing' : 'touch-pan-y'
          }`}
        >
          <div
            className="origin-top-left will-change-transform"
            style={{ transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})` }}
          >
            <svg
              viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
              role="group"
              aria-label="Denah booth interaktif"
              aria-describedby="peta-hint"
              className="block h-auto w-full select-none"
              onClick={(event) => {
                if (event.target === event.currentTarget && !suppressClickRef.current) {
                  setActiveBooth(null)
                }
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
                />
              )}

              <rect
                x="0"
                y="0"
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                fill="url(#tenant-blueprint-grid)"
                opacity={blueprintImageUrl ? '0.35' : '0.8'}
              />

              {!blueprintImageUrl && (
                <text
                  x={CANVAS_WIDTH / 2}
                  y="32"
                  textAnchor="middle"
                  className="pointer-events-none fill-gray-500 text-[11px] font-semibold tracking-[0.3em]"
                >
                  AREA PAMERAN
                </text>
              )}

              {!blueprintImageUrl && (
                <text
                  x={CANVAS_WIDTH / 2}
                  y={CANVAS_HEIGHT - 20}
                  textAnchor="middle"
                  className="pointer-events-none fill-gray-500 text-[11px] font-semibold tracking-[0.3em]"
                >
                  PINTU MASUK
                </text>
              )}

              {booths.map((booth) => {
                const isSelected = booth.id === activeBoothId
                const isUnavailable = booth.status !== 'Available'
                const isReserved = booth.status === 'Reserved'
                const isDimmed = activeCategory !== 'all' && booth.category !== activeCategory

                const rectTone = isUnavailable
                  ? `${isReserved ? 'fill-unavailable' : 'fill-unavailable-deep'} ${
                      isSelected ? 'stroke-pine-dark' : 'stroke-muted'
                    }`
                  : isSelected
                    ? 'fill-pine stroke-pine-dark'
                    : 'fill-surface stroke-pine hover:fill-pine-soft hover:stroke-pine-dark'

                const titleTone = isSelected && !isUnavailable ? 'fill-white' : 'fill-ink'
                const metaTone = isSelected && !isUnavailable ? 'fill-pine-soft' : 'fill-muted'
                const priceTone =
                  isSelected && !isUnavailable
                    ? 'fill-white'
                    : isUnavailable
                      ? 'fill-muted'
                      : 'fill-ink'

                return (
                  <g
                    key={booth.id}
                    data-booth-id={booth.id}
                    data-booth-status={booth.status}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    aria-label={`Booth ${categoryLabel[booth.category]}, ${formatPrice(booth.price)}, status ${statusLabel[booth.status]}`}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setActiveBooth(booth.id)
                      }
                      if (event.key === 'Escape') {
                        setActiveBooth(null)
                      }
                    }}
                    onClick={() => setActiveBooth(booth.id)}
                    className={`group cursor-pointer outline-none transition-opacity focus-visible:outline-none motion-reduce:transition-none ${
                      isDimmed ? 'opacity-30' : 'opacity-100'
                    }`}
                  >
                    <title>{`${categoryLabel[booth.category]} — ${statusLabel[booth.status]}`}</title>

                    <rect
                      x={booth.positionX}
                      y={booth.positionY}
                      width={booth.width}
                      height={booth.height}
                      rx="8"
                      strokeWidth={isSelected ? 2.6 : 1.4}
                      strokeDasharray={isReserved ? '4 3' : undefined}
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
                      className={`pointer-events-none text-[11px] font-semibold ${titleTone}`}
                    >
                      {categoryLabel[booth.category]}
                    </text>

                    <text
                      x={booth.positionX + 12}
                      y={booth.positionY + 38}
                      className={`pointer-events-none text-[9px] font-medium ${metaTone}`}
                    >
                      {statusLabel[booth.status]}
                    </text>

                    <text
                      x={booth.positionX + 12}
                      y={booth.positionY + booth.height - 12}
                      className={`pointer-events-none text-[9px] font-medium tabular-nums ${priceTone}`}
                    >
                      {formatPrice(booth.price)}
                    </text>

                    {isSelected && (
                      <g
                        transform={`translate(${booth.positionX + booth.width - 14} ${booth.positionY + 14})`}
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
            </svg>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center px-3">
            <span className="rounded-[4px] border border-line bg-surface px-3 py-1 text-[10px] font-medium text-muted">
              {isZoomed ? 'Seret peta untuk menggeser' : 'Cubit atau Ctrl + scroll untuk zoom'}
            </span>
          </div>

          {booths.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <div className="rounded-[8px] border border-line bg-surface px-6 py-5 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-[6px] bg-canvas text-muted">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                  </svg>
                </div>
                <p className="mt-3 text-sm font-semibold text-ink">Belum ada booth</p>
                <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted">
                  Penyelenggara belum menambahkan booth pada event ini.
                </p>
              </div>
            </div>
          )}
        </div>

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
            Pilih booth untuk melihat detail. Booth terisi tetap bisa diperiksa statusnya.
          </p>
        </div>
      </div>

      <div className="border-t border-line bg-surface px-4 py-4 sm:px-5" aria-live="polite">
        {activeBooth ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] border border-line bg-canvas text-[10px] font-semibold tabular-nums text-pine">
                {activeBooth.category}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">
                  Booth {categoryLabel[activeBooth.category]}{' '}
                  <span className="font-normal text-muted">· {activeBooth.id.slice(0, 8)}</span>
                </p>
                <p className="mt-0.5 text-xs tabular-nums text-muted">
                  {statusLabel[activeBooth.status]} · {formatPrice(activeBooth.price)} ·{' '}
                  {activeBooth.width} × {activeBooth.height} px
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveBooth(null)}
              className="rounded-[4px] text-xs font-semibold text-muted underline decoration-line underline-offset-4 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none"
            >
              Tutup pilihan
            </button>
          </div>
        ) : (
          <p className="text-sm text-muted">
            Pilih salah satu booth pada denah untuk melihat ukuran, harga, dan statusnya. Detail
            lengkap muncul di panel samping.
          </p>
        )}
      </div>
    </div>
  )
}
