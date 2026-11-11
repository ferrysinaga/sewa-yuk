import { useMemo, useState } from 'react'
import BoothMapCanvas from './BoothMapCanvas'
import BoothMapDetail from './BoothMapDetail'
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  MAX_ZOOM,
  MIN_ZOOM,
  booths,
  categoryFilters,
} from './landingContent'
import type { Category } from './landingContent'

export default function BoothMap() {
  const [activeId, setActiveId] = useState<string | null>('A-01')
  const [category, setCategory] = useState<Category | 'all'>('all')
  const [zoom, setZoom] = useState(MIN_ZOOM)

  const activeBooth = booths.find((booth) => booth.id === activeId) ?? null
  const availableCount = booths.filter((booth) => booth.status === 'Available').length
  const isZoomed = zoom > MIN_ZOOM + 0.001
  const canZoomIn = zoom < MAX_ZOOM - 0.001
  const zoomPercent = Math.round(zoom * 100)

  const viewBox = useMemo(() => {
    const width = MAP_WIDTH / zoom
    const height = MAP_HEIGHT / zoom
    const focus = activeBooth
      ? { x: activeBooth.x + activeBooth.width / 2, y: activeBooth.y + activeBooth.height / 2 }
      : { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 }

    const x = Math.min(Math.max(focus.x - width / 2, 0), MAP_WIDTH - width)
    const y = Math.min(Math.max(focus.y - height / 2, 0), MAP_HEIGHT - height)

    return `${x} ${y} ${width} ${height}`
  }, [activeBooth, zoom])

  const zoomBy = (factor: number) => {
    setZoom((current) =>
      Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number((current * factor).toFixed(3)))),
    )
  }

  const handleCategoryChange = (next: Category | 'all') => {
    setCategory(next)
    if (next !== 'all' && activeBooth && activeBooth.category !== next) {
      setActiveId(null)
      setZoom(MIN_ZOOM)
    }
  }

  const clearSelection = () => {
    setActiveId(null)
    setZoom(MIN_ZOOM)
  }

  const selectBooth = (id: string) => {
    setActiveId(id)
    const booth = booths.find((item) => item.id === id)
    if (category !== 'all' && booth && booth.category !== category) {
      setCategory('all')
    }
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-card border border-line bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="h-1.5 w-1.5 bg-clay" />
            <p className="text-tiny font-semibold uppercase tracking-[0.18em] text-muted">
              Pratinjau denah
            </p>
          </div>
          <h2 className="mt-2 text-base font-semibold leading-snug tracking-tight text-ink sm:text-lg">
            Pameran Teknologi Nusantara 2026
          </h2>
          <p className="mt-1 text-xs text-muted">
            12–15 Maret 2026 · Jakarta Convention Center, Hall A
          </p>
        </div>
        <div className="text-right">
          <p className="text-tiny font-semibold uppercase tracking-[0.14em] text-muted">
            Booth contoh
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-ink">
            {availableCount}
            <span className="text-sm font-medium text-muted"> / {booths.length}</span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-tiny font-semibold uppercase tracking-[0.14em] text-muted">
            Sorot
          </span>
          {categoryFilters.map((item) => {
            const isActive = category === item.value
            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={isActive}
                onClick={() => handleCategoryChange(item.value)}
                className={`inline-flex min-h-[34px] items-center rounded-control border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none ${
                  isActive
                    ? 'border-pine bg-pine text-on-accent'
                    : 'border-line bg-surface text-muted hover:border-pine hover:text-pine'
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </div>

        <div
          role="group"
          aria-label="Kontrol zoom denah"
          className="flex items-center gap-0.5 rounded-control border border-line bg-surface p-0.5"
        >
          <button
            type="button"
            onClick={() => zoomBy(1.25)}
            disabled={!canZoomIn}
            aria-label="Perbesar denah"
            className="flex h-11 w-11 items-center justify-center rounded-control text-ink transition-colors hover:bg-pine-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
              <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
            </svg>
          </button>
          <span className="px-1 text-tiny font-semibold tabular-nums text-muted">
            {zoomPercent}%
          </span>
          <button
            type="button"
            onClick={() => zoomBy(0.8)}
            disabled={!isZoomed}
            aria-label="Perkecil denah"
            className="flex h-11 w-11 items-center justify-center rounded-control text-ink transition-colors hover:bg-pine-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
              <path d="M4 10a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H4.75A.75.75 0 0 1 4 10Z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setZoom(MIN_ZOOM)}
            disabled={!isZoomed}
            aria-label="Reset zoom denah ke 1×"
            className="flex h-11 w-11 items-center justify-center rounded-control text-tiny font-bold text-muted transition-colors hover:bg-pine-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
          >
            1×
          </button>
        </div>
      </div>

      <BoothMapCanvas
        viewBox={viewBox}
        activeBooth={activeBooth}
        category={category}
        onSelectBooth={selectBooth}
        onClearSelection={clearSelection}
      />

      <BoothMapDetail activeBooth={activeBooth} onClearSelection={clearSelection} />
    </div>
  )
}
