import { useBoothStore } from '../../store/useBoothStore'
import type { BoothCategory } from '../../types/booth'

const categoryFilters: { value: BoothCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'F&B', label: 'F&B' },
  { value: 'Tech', label: 'Teknologi' },
  { value: 'Apparel', label: 'Pakaian' },
]

interface TenantFilterProps {
  activeCategory: BoothCategory | 'all'
  onCategoryChange: (category: BoothCategory | 'all') => void
}

/**
 * Kartu filter dipisah dari panel detail agar dapat dirender sebelum peta pada
 * layar sempit, sementara di desktop tetap berada di kolom kanan. State filter
 * tetap satu dan dimiliki halaman.
 */
export default function TenantFilter({ activeCategory, onCategoryChange }: TenantFilterProps) {
  const booths = useBoothStore((state) => state.booths)

  return (
    <section
      aria-labelledby="filter-kategori-heading"
      className="rounded-card border border-line bg-surface p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="filter-kategori-heading" className="text-sm font-semibold text-ink">
          Filter kategori
        </h2>
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
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-control border px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none ${
                isActive
                  ? 'border-pine bg-pine text-on-accent'
                  : 'border-line bg-surface text-muted hover:border-pine hover:text-pine'
              }`}
            >
              {filter.label}
              <span
                className={`rounded-chip px-1.5 py-0.5 text-tiny font-semibold tabular-nums ${
                  isActive ? 'bg-pine-dark text-on-accent' : 'bg-canvas text-muted'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
