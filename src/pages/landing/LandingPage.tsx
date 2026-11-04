import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

type Category = 'Tech' | 'F&B' | 'Apparel'
type BoothStatus = 'Available' | 'Reserved' | 'Booked'

interface Booth {
  id: string
  label: string
  category: Category
  price: number
  size: string
  note: string
  x: number
  y: number
  width: number
  height: number
  status: BoothStatus
}

const MAP_WIDTH = 520
const MAP_HEIGHT = 400
const MIN_ZOOM = 1
const MAX_ZOOM = 2

const booths: Booth[] = [
  { id: 'A-01', label: 'Booth A-01', category: 'Tech', price: 4500000, size: '3 × 3 m', note: 'Sayap kiri · dekat aisle utama', x: 24, y: 64, width: 120, height: 76, status: 'Available' },
  { id: 'A-02', label: 'Booth A-02', category: 'F&B', price: 3800000, size: '3 × 3 m', note: 'Sayap kiri · dekat area makanan', x: 24, y: 152, width: 120, height: 76, status: 'Available' },
  { id: 'A-03', label: 'Booth A-03', category: 'Apparel', price: 3200000, size: '3 × 3 m', note: 'Sayap kiri · dekat area fashion', x: 24, y: 240, width: 120, height: 76, status: 'Booked' },
  { id: 'A-04', label: 'Booth A-04', category: 'Tech', price: 2900000, size: '2 × 3 m', note: 'Sayap kiri · dekat pintu masuk', x: 24, y: 320, width: 120, height: 64, status: 'Available' },
  { id: 'B-01', label: 'Booth B-01', category: 'F&B', price: 6200000, size: '4 × 3 m', note: 'Area tengah · posisi premium', x: 300, y: 64, width: 196, height: 88, status: 'Available' },
  { id: 'B-02', label: 'Booth B-02', category: 'Tech', price: 7400000, size: '4 × 3 m', note: 'Area tengah · paling strategis', x: 300, y: 164, width: 196, height: 88, status: 'Available' },
  { id: 'B-03', label: 'Booth B-03', category: 'Apparel', price: 5100000, size: '4 × 3 m', note: 'Area tengah · dekat pintu masuk', x: 300, y: 264, width: 196, height: 88, status: 'Reserved' },
]

const formatPrice = (price: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(price)

const categoryLabel: Record<Category, string> = {
  Tech: 'Teknologi',
  'F&B': 'F&B',
  Apparel: 'Pakaian',
}

const statusLabel: Record<BoothStatus, string> = {
  Available: 'Tersedia',
  Reserved: 'Dipesan',
  Booked: 'Terisi',
}

const categoryFilters: Array<{ value: Category | 'all'; label: string }> = [
  { value: 'all', label: 'Semua' },
  { value: 'Tech', label: 'Teknologi' },
  { value: 'F&B', label: 'F&B' },
  { value: 'Apparel', label: 'Pakaian' },
]

const navItems = [
  { label: 'Acara', href: '#acara' },
  { label: 'Cara kerja', href: '#cara-kerja' },
  { label: 'Penyelenggara', href: '#penyelenggara' },
]

const events = [
  {
    id: 'hall-a',
    title: 'Pameran Teknologi Nusantara 2026',
    venue: 'Jakarta Convention Center · Hall A',
    day: '12–15',
    month: 'Mar 2026',
    category: 'Teknologi',
    available: 42,
    total: 120,
  },
  {
    id: 'hall-b',
    title: 'Festival Kuliner Merdeka',
    venue: 'Grand City Convention · Hall B',
    day: '2–5',
    month: 'Apr 2026',
    category: 'F&B',
    available: 18,
    total: 90,
  },
  {
    id: 'hall-5',
    title: 'Indonesia Fashion Week',
    venue: 'ICE BSD · Hall 5',
    day: '21–26',
    month: 'Apr 2026',
    category: 'Pakaian',
    available: 31,
    total: 140,
  },
]

const values = [
  {
    title: 'Lokasi terbaca sebelum bayar',
    description:
      'Lihat posisi booth terhadap pintu masuk, lorong utama, dan booth tetangga. Bandingkan ukuran serta harga tanpa menebak.',
  },
  {
    title: 'Status tidak pernah tertinggal',
    description:
      'Booth yang baru dikunci langsung berubah di layar semua orang, sehingga tidak ada dua penyewa yang merasa memegang lokasi yang sama.',
  },
  {
    title: 'Satu denah untuk semua',
    description:
      'Penyelenggara menyusun tata letak, penyewa membaca denah yang sama. Perubahan langsung tersaji tanpa file gambar terpisah.',
  },
]

const organizerPoints = [
  'Seret booth di kanvas dengan bantuan grid',
  'Atur kategori, harga, dan dimensi tiap booth',
  'Publikasikan denah ke halaman penyewa',
]

const tenantPoints = [
  'Sorot booth sesuai kategori dan kebutuhan',
  'Buka detail lewat klik atau navigasi keyboard',
  'Kunci posisi secara real-time sebelum diambil',
]

const steps = [
  {
    title: 'Pilih acara',
    description: 'Buka acara yang masih menerima penyewa, lalu periksa tanggal dan lokasinya.',
  },
  {
    title: 'Baca denah',
    description: 'Sorot kategori, pilih booth, dan periksa ukuran, harga, serta statusnya.',
  },
  {
    title: 'Kunci booth',
    description: 'Masuk untuk mengunci pilihan. Booth langsung ditandai agar tidak diambil orang lain.',
  },
]

function ArrowRight({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M4 10h11m-4-4 4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ArrowDown({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path
        d="M10 4v11m-4-4 4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pine">
      <path
        d="m3.5 8.5 3 3 6-7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function BrandMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-[7px] bg-pine text-white ${className}`}>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
        <rect x="4" y="4" width="7" height="6" rx="1" stroke="currentColor" strokeWidth="1.6" />
        <rect x="13" y="4" width="7" height="6" rx="1" stroke="currentColor" strokeWidth="1.6" />
        <rect x="4" y="12" width="7" height="8" rx="1" stroke="currentColor" strokeWidth="1.6" />
        <rect x="13" y="12" width="7" height="8" rx="1" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    </span>
  )
}

function StatusBadge({ status }: { status: BoothStatus }) {
  const tone =
    status === 'Available'
      ? 'bg-pine-soft text-pine'
      : status === 'Reserved'
        ? 'border border-dashed border-muted bg-unavailable text-ink'
        : 'bg-unavailable-deep text-ink'

  return (
    <span className={`inline-flex items-center rounded-[4px] px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
      {statusLabel[status]}
    </span>
  )
}

function BoothMap() {
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
    <div className="min-w-0 overflow-hidden rounded-[10px] border border-line bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="h-1.5 w-1.5 bg-clay" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
              Pratinjau denah
            </p>
          </div>
          <h2 className="mt-2 text-base font-semibold leading-snug tracking-tight text-ink sm:text-lg">
            Pameran Teknologi Nusantara 2026
          </h2>
          <p className="mt-1 text-xs text-muted">12–15 Maret 2026 · Jakarta Convention Center, Hall A</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
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
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
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
                className={`inline-flex min-h-[34px] items-center rounded-[6px] border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none ${
                  isActive
                    ? 'border-pine bg-pine text-white'
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
          className="flex items-center gap-0.5 rounded-[6px] border border-line bg-surface p-0.5"
        >
          <button
            type="button"
            onClick={() => zoomBy(1.25)}
            disabled={!canZoomIn}
            aria-label="Perbesar denah"
            className="flex h-8 w-8 items-center justify-center rounded-[5px] text-ink transition-colors hover:bg-pine-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
              <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
            </svg>
          </button>
          <span className="px-1 text-[10px] font-semibold tabular-nums text-muted">
            {zoomPercent}%
          </span>
          <button
            type="button"
            onClick={() => zoomBy(0.8)}
            disabled={!isZoomed}
            aria-label="Perkecil denah"
            className="flex h-8 w-8 items-center justify-center rounded-[5px] text-ink transition-colors hover:bg-pine-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
              <path d="M4 10a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H4.75A.75.75 0 0 1 4 10Z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setZoom(MIN_ZOOM)}
            disabled={!isZoomed}
            aria-label="Reset zoom denah"
            className="flex h-8 w-8 items-center justify-center rounded-[5px] text-[10px] font-bold text-muted transition-colors hover:bg-pine-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
          >
            1×
          </button>
        </div>
      </div>

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
              onClick={clearSelection}
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
                  aria-label={`${booth.label}, ${categoryLabel[booth.category]}, ${booth.size}, ${booth.note}, ${formatPrice(
                    booth.price,
                  )}, ${statusLabel[booth.status]}`}
                  onClick={() => selectBooth(booth.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      selectBooth(booth.id)
                    }
                    if (event.key === 'Escape') {
                      clearSelection()
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
                  <text
                    x={booth.x + 12}
                    y={booth.y + 40}
                    className={`pointer-events-none text-[9px] font-medium ${metaTone}`}
                  >
                    {categoryLabel[booth.category]} · {statusLabel[booth.status]}
                  </text>
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
              onClick={clearSelection}
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
    </div>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-[6px] focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Lewati ke konten utama
      </a>

      <header className="sticky top-0 z-40 border-b border-line bg-canvas">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            aria-label="sewa-yuk, kembali ke beranda"
            className="flex items-center gap-2.5 rounded-[6px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          >
            <BrandMark />
            <span className="leading-tight">
              <span className="block text-sm font-semibold tracking-tight text-ink">sewa-yuk</span>
              <span className="hidden text-[10px] uppercase tracking-[0.14em] text-muted sm:block">
                Peta booth pameran
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Navigasi utama">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-[6px] px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="hidden rounded-[6px] px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-pine-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-canvas sm:inline-flex motion-reduce:transition-none"
            >
              Masuk
            </Link>
            <Link
              to="/event"
              className="inline-flex items-center justify-center gap-2 rounded-[6px] bg-pine px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none"
            >
              Cari booth
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="focus:outline-none">
        <section className="border-b border-line bg-canvas">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-12 pt-10 sm:px-6 sm:pb-16 sm:pt-14 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start lg:gap-14 lg:px-8 lg:pb-20 lg:pt-20">
            <div className="max-w-xl">
              <div className="flex items-center gap-2.5">
                <span aria-hidden="true" className="h-2 w-2 bg-clay" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                  Sewa booth pameran
                </p>
              </div>

              <h1 className="mt-5 text-[2.5rem] font-semibold leading-[1.06] tracking-[-0.03em] text-ink sm:text-5xl lg:text-[3.4rem]">
                Pilih posisinya.
                <br />
                Kunci booth-nya.
              </h1>

              <p className="mt-5 max-w-lg text-base leading-relaxed text-muted sm:text-[17px]">
                Bandingkan lokasi, ukuran, dan harga booth langsung di atas denah acara. Status
                diperbarui otomatis, jadi satu booth hanya bisa diambil satu penyewa.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  to="/event"
                  className="inline-flex items-center justify-center gap-2 rounded-[6px] bg-pine px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none"
                >
                  Jelajahi acara
                  <ArrowRight />
                </Link>
                <a
                  href="#cara-kerja"
                  className="inline-flex items-center justify-center gap-2 rounded-[6px] px-1 py-2 text-sm font-semibold text-pine transition-colors hover:text-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-canvas sm:px-3 motion-reduce:transition-none"
                >
                  Lihat cara kerja
                  <ArrowDown />
                </a>
              </div>

              <ul className="mt-9 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-5 text-xs font-medium text-muted">
                {['Peta interaktif', 'Status real-time', 'Satu booth, satu penyewa'].map(
                  (item, index) => (
                    <li key={item} className="flex items-center gap-3">
                      {index > 0 && (
                        <span aria-hidden="true" className="h-1 w-1 rounded-full bg-line" />
                      )}
                      {item}
                    </li>
                  ),
                )}
              </ul>
            </div>

            <div className="min-w-0">
              <BoothMap />
            </div>
          </div>
        </section>

        <section id="acara" className="scroll-mt-20 border-b border-line bg-surface">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2.5">
                  <span aria-hidden="true" className="h-px w-6 bg-clay" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                    Agenda
                  </p>
                </div>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                  Acara yang masih membuka booth.
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  Lihat denah, bandingkan posisi, lalu kunci booth sebelum diambil penyewa lain.
                </p>
              </div>
              <Link
                to="/event"
                className="inline-flex items-center gap-2 rounded-[6px] text-sm font-semibold text-pine transition-colors hover:text-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none"
              >
                Lihat semua acara
                <ArrowRight />
              </Link>
            </div>

            <div className="mt-9 divide-y divide-line border-y border-line">
              {events.map((event) => (
                <Link
                  key={event.id}
                  to={`/event/${event.id}`}
                  className="group grid gap-4 px-1 py-5 transition-colors hover:bg-pine-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pine sm:grid-cols-[92px_minmax(0,1fr)_auto] sm:items-center sm:gap-6 sm:px-4 motion-reduce:transition-none"
                >
                  <div className="flex items-baseline gap-2 sm:block">
                    <p className="text-xl font-semibold tabular-nums tracking-tight text-ink sm:text-2xl">
                      {event.day}
                    </p>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                      {event.month}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-ink">{event.title}</h3>
                      <span className="rounded-[4px] border border-line bg-surface px-1.5 py-0.5 text-[10px] font-medium text-muted">
                        {event.category}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted">{event.venue}</p>
                  </div>

                  <div className="flex items-center justify-between gap-5 sm:justify-end sm:text-right">
                    <div>
                      <p className="text-sm font-semibold tabular-nums text-ink">
                        {event.available}{' '}
                        <span className="font-normal text-muted">dari {event.total}</span>
                      </p>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                        booth tersedia
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-pine transition-colors group-hover:text-pine-dark">
                      Lihat denah
                      <ArrowRight />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section id="kenapa" className="scroll-mt-20 bg-canvas">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2.5">
                <span aria-hidden="true" className="h-px w-6 bg-clay" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                  Kerja di atas denah
                </p>
              </div>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                Bukan daftar harga. Ini denah yang bisa dibaca.
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
                Keputusan sewa booth dibuat dari posisi, bukan dari nama booth semata. Semua informasi
                yang dibutuhkan ada di satu bidang yang sama.
              </p>
            </div>

            <div className="mt-10 grid gap-x-8 gap-y-8 md:grid-cols-3">
              {values.map((value, index) => (
                <div key={value.title} className="border-t border-line pt-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-clay-dark">
                    {String(index + 1).padStart(2, '0')}
                  </p>
                  <h3 className="mt-4 text-lg font-semibold text-ink">{value.title}</h3>
                  <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
                    {value.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="penyelenggara" className="scroll-mt-20 border-y border-line bg-surface">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2.5">
                <span aria-hidden="true" className="h-px w-6 bg-clay" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                  Dua peran, satu denah
                </p>
              </div>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                Dibuat untuk yang menyusun, dan yang memilih.
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
                Tata letak dan data booth tidak perlu dikelola di dua tempat berbeda.
              </p>
            </div>

            <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:gap-14">
              <article className="border-t border-line pt-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-pine">
                    Penyelenggara
                  </p>
                  <span className="text-[11px] text-muted">Dashboard admin</span>
                </div>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
                  Susun denah, publikasikan sekali.
                </h3>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
                  Ruang kerja drag-and-drop dengan bantuan grid. Atur kategori, harga, dan ukuran
                  booth, lalu tampilkan denah yang sama ke halaman acara.
                </p>
                <ul className="mt-5 space-y-2.5">
                  {organizerPoints.map((point) => (
                    <li key={point} className="flex items-start gap-2.5 text-sm text-ink">
                      <CheckIcon />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/admin"
                  className="mt-7 inline-flex items-center gap-2 rounded-[6px] text-sm font-semibold text-pine transition-colors hover:text-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none"
                >
                  Buka dashboard
                  <ArrowRight />
                </Link>
              </article>

              <article className="border-t border-line pt-6 lg:border-l lg:pl-14">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-pine">
                    Penyewa
                  </p>
                  <span className="text-[11px] text-muted">Halaman acara</span>
                </div>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-ink">
                  Baca denah, kunci posisi.
                </h3>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
                  Sorot kategori, bandingkan posisi, dan buka detail booth langsung dari peta. Status
                  serta harga selalu mengikuti data terbaru.
                </p>
                <ul className="mt-5 space-y-2.5">
                  {tenantPoints.map((point) => (
                    <li key={point} className="flex items-start gap-2.5 text-sm text-ink">
                      <CheckIcon />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/event"
                  className="mt-7 inline-flex items-center justify-center gap-2 rounded-[6px] bg-pine px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none"
                >
                  Jelajahi acara
                  <ArrowRight />
                </Link>
              </article>
            </div>
          </div>
        </section>

        <section id="cara-kerja" className="scroll-mt-20 bg-canvas">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2.5">
                  <span aria-hidden="true" className="h-px w-6 bg-clay" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                    Alur kerja
                  </p>
                </div>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                  Tiga langkah, satu keputusan.
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-relaxed text-muted">
                Tanpa unduhan. Bisa dibuka dari browser di ponsel maupun desktop.
              </p>
            </div>

            <ol className="mt-10 grid gap-8 md:grid-cols-3">
              {steps.map((step, index) => (
                <li key={step.title} className="border-t border-line pt-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-clay-dark">
                    Langkah {String(index + 1).padStart(2, '0')}
                  </p>
                  <h3 className="mt-3 text-lg font-semibold text-ink">{step.title}</h3>
                  <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">
                    {step.description}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="bg-pine">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div>
                <div className="flex items-center gap-2.5">
                  <span aria-hidden="true" className="h-2 w-2 bg-clay" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-pine-soft">
                    Mulai dari denah
                  </p>
                </div>
                <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  Booth yang tepat biasanya diambil lebih dulu.
                </h2>
                <p className="mt-4 max-w-xl text-sm leading-relaxed text-pine-soft">
                  Bandingkan posisi dan status booth, lalu kunci lokasi sebelum acara dimulai.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
                <Link
                  to="/event"
                  className="inline-flex items-center justify-center gap-2 rounded-[6px] bg-white px-5 py-3 text-sm font-semibold text-pine transition-colors hover:bg-pine-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-pine motion-reduce:transition-none"
                >
                  Cari booth
                  <ArrowRight />
                </Link>
                <Link
                  to="/admin"
                  className="inline-flex items-center justify-center rounded-[6px] border border-pine-soft px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-pine-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-pine motion-reduce:transition-none"
                >
                  Buka dashboard
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-canvas">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2.5">
              <BrandMark className="h-8 w-8" />
              <div>
                <p className="text-sm font-semibold text-ink">sewa-yuk</p>
                <p className="text-[11px] text-muted">Peta booth untuk acara yang lebih rapi.</p>
              </div>
            </div>

            <nav
              className="flex flex-wrap items-center gap-x-5 gap-y-2"
              aria-label="Navigasi footer"
            >
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-[4px] text-sm text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none"
                >
                  {item.label}
                </a>
              ))}
              <Link
                to="/login"
                className="rounded-[4px] text-sm text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none"
              >
                Masuk
              </Link>
            </nav>

            <p className="text-xs text-muted">© 2026 sewa-yuk. Semua hak dilindungi.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

