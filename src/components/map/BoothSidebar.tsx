import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { useBoothStore } from '../../store/useBoothStore'
import type { Booth, BoothCategory, BoothTemplate } from '../../types/booth'

export const boothTemplates: BoothTemplate[] = [
  { category: 'Tech', width: 160, height: 120, price: 4500000 },
  { category: 'F&B', width: 140, height: 100, price: 3800000 },
  { category: 'Apparel', width: 120, height: 100, price: 3200000 },
]

const categoryIcon: Record<BoothCategory, ReactNode> = {
  Tech: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
    </svg>
  ),
  'F&B': (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
  ),
  Apparel: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-3.75-3.75a3 3 0 0 0-2.122-.879h-6.257a3 3 0 0 0-2.12.879L3 7.5m18 0-3.75 3.75V21H6.75V11.25L3 7.5m18 0h-4.5L12 12l-4.5-4.5H3" />
    </svg>
  ),
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(price)

const categoryOptions: BoothCategory[] = ['Tech', 'F&B', 'Apparel']

const statusLabel = {
  Available: 'Tersedia',
  Reserved: 'Dipesan',
  Booked: 'Terisi',
} as const

function BoothProperties({ booth }: { booth: Booth }) {
  const updateBoothDetails = useBoothStore((state) => state.updateBoothDetails)
  const [priceDraft, setPriceDraft] = useState(String(booth.price))

  useEffect(() => {
    setPriceDraft(String(booth.price))
  }, [booth.id, booth.price])

  const handlePriceChange = (value: string) => {
    const digitsOnly = value.replace(/[^\d]/g, '')
    setPriceDraft(digitsOnly)

    if (digitsOnly === '') return

    const parsed = Number(digitsOnly)
    if (Number.isFinite(parsed)) {
      updateBoothDetails(booth.id, { price: parsed })
    }
  }

  const handlePriceBlur = () => {
    if (priceDraft === '') {
      setPriceDraft(String(booth.price))
    }
  }

  return (
    <div className="mt-3 space-y-3">
      <div>
        <label
          htmlFor={`booth-category-${booth.id}`}
          className="text-xs font-medium text-gray-700"
        >
          Kategori
        </label>
        <select
          id={`booth-category-${booth.id}`}
          value={booth.category}
          onChange={(event) =>
            updateBoothDetails(booth.id, {
              category: event.target.value as BoothCategory,
            })
          }
          className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        >
          {categoryOptions.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor={`booth-price-${booth.id}`}
          className="text-xs font-medium text-gray-700"
        >
          Harga sewa (IDR)
        </label>
        <input
          id={`booth-price-${booth.id}`}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={priceDraft}
          onChange={(event) => handlePriceChange(event.target.value)}
          onBlur={handlePriceBlur}
          placeholder="Contoh: 4500000"
          className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
        <p className="mt-1 text-[11px] text-gray-500">
          Terbaca sebagai {formatPrice(booth.price)}
        </p>
      </div>
    </div>
  )
}

function PaletteItem({ template }: { template: BoothTemplate }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${template.category}`,
    data: { type: 'palette', template },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      aria-label={`Tarik booth kategori ${template.category}`}
      className={`cursor-grab rounded-xl border bg-white p-3 shadow-sm transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 active:cursor-grabbing ${
        isDragging ? 'border-blue-300 opacity-40' : 'border-gray-200'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-700">
          {categoryIcon[template.category]}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{template.category}</p>
          <p className="text-xs text-gray-500">
            {template.width} × {template.height} px
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2.5">
        <span className="text-xs font-medium text-gray-600">{formatPrice(template.price)}</span>
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
            <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h3A1.5 1.5 0 0 1 13 3.5v.75h2.25a.75.75 0 0 1 0 1.5h-.31l-.86 11.18A2.25 2.25 0 0 1 11.84 19H8.16a2.25 2.25 0 0 1-2.24-2.07l-.86-11.18h-.31a.75.75 0 0 1 0-1.5H7V3.5Z" />
          </svg>
          Tarik
        </span>
      </div>
    </div>
  )
}

export default function BoothSidebar() {
  const activeBooth = useBoothStore(
    (state) => state.booths.find((booth) => booth.id === state.activeBoothId) ?? null,
  )
  const removeBooth = useBoothStore((state) => state.removeBooth)

  return (
    <aside className="w-full shrink-0 lg:w-72">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Pilihan Booth</h2>
        <p className="mt-1 text-xs leading-relaxed text-gray-500">
          Tarik kategori booth ke area kanvas untuk menempatkannya.
        </p>

        <div className="mt-3 space-y-2.5">
          {boothTemplates.map((template) => (
            <PaletteItem key={template.category} template={template} />
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Detail Booth</h2>

        {activeBooth ? (
          <div className="mt-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">{activeBooth.category}</p>
                <p className="text-xs text-gray-500">ID: {activeBooth.id.slice(0, 8)}</p>
              </div>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-100">
                {statusLabel[activeBooth.status]}
              </span>
            </div>

            <BoothProperties key={activeBooth.id} booth={activeBooth} />

            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-gray-50 p-2">
                <dt className="text-gray-500">Harga</dt>
                <dd className="mt-0.5 font-semibold text-gray-900">{formatPrice(activeBooth.price)}</dd>
              </div>
              <div className="rounded-xl bg-gray-50 p-2">
                <dt className="text-gray-500">Ukuran</dt>
                <dd className="mt-0.5 font-semibold text-gray-900">
                  {activeBooth.width} × {activeBooth.height}
                </dd>
              </div>
              <div className="rounded-xl bg-gray-50 p-2">
                <dt className="text-gray-500">Posisi X</dt>
                <dd className="mt-0.5 font-semibold text-gray-900">{Math.round(activeBooth.positionX)} px</dd>
              </div>
              <div className="rounded-xl bg-gray-50 p-2">
                <dt className="text-gray-500">Posisi Y</dt>
                <dd className="mt-0.5 font-semibold text-gray-900">{Math.round(activeBooth.positionY)} px</dd>
              </div>
            </dl>

            <p className="mt-3 text-[11px] leading-relaxed text-gray-500">
              Perubahan kategori dan harga langsung diterapkan ke state. Klik “Simpan Perubahan
              Denah” untuk menyimpannya permanen.
            </p>

            <button
              type="button"
              onClick={() => removeBooth(activeBooth.id)}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path
                  fillRule="evenodd"
                  d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482 41.03 41.03 0 0 0-2.365-.298V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
                  clipRule="evenodd"
                />
              </svg>
              Hapus Booth
            </button>
          </div>
        ) : (
          <p className="mt-2 text-xs leading-relaxed text-gray-500">
            Klik salah satu booth di kanvas untuk melihat detail dan posisi spasialnya.
          </p>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
        <p className="text-xs font-semibold text-blue-800">Snap-to-grid aktif</p>
        <p className="mt-1 text-xs leading-relaxed text-blue-700">
          Booth otomatis menempel pada grid 20 px agar tata letak tetap rapi dan presisi.
        </p>
      </div>
    </aside>
  )
}
