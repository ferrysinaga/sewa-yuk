import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useDraggable } from '@dnd-kit/core'
import {
  BOOTH_CATEGORY_LABEL as categoryLabel,
  BOOTH_STATUS_LABEL as statusLabel,
  BOOTH_STATUS_META,
  formatPrice,
} from '../../lib/boothDisplay'
import { useBoothStore } from '../../store/useBoothStore'
import type { Booth, BoothCategory, BoothStatus, BoothTemplate } from '../../types/booth'
import InlineConfirm from '../ui/InlineConfirm'

export const boothTemplates: BoothTemplate[] = [
  { category: 'Tech', width: 160, height: 120, price: 4500000 },
  { category: 'F&B', width: 140, height: 100, price: 3800000 },
  { category: 'Apparel', width: 120, height: 100, price: 3200000 },
]

const categoryIcon: Record<BoothCategory, ReactNode> = {
  Tech: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25"
      />
    </svg>
  ),
  'F&B': (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
      />
    </svg>
  ),
  Apparel: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m21 7.5-3.75-3.75a3 3 0 0 0-2.122-.879h-6.257a3 3 0 0 0-2.12.879L3 7.5m18 0-3.75 3.75V21H6.75V11.25L3 7.5m18 0h-4.5L12 12l-4.5-4.5H3"
      />
    </svg>
  ),
}

const categoryOptions: BoothCategory[] = ['Tech', 'F&B', 'Apparel']
const statusOptions: BoothStatus[] = ['Available', 'Reserved', 'Booked']
const fieldClass =
  'mt-1.5 w-full rounded-[8px] border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine-soft'

function BoothProperties({ booth }: { booth: Booth }) {
  const updateBoothDetails = useBoothStore((state) => state.updateBoothDetails)
  const updateBoothStatus = useBoothStore((state) => state.updateBoothStatus)
  const markDirty = useBoothStore((state) => state.markDirty)
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
        <label htmlFor={`booth-category-${booth.id}`} className="text-xs font-medium text-ink">
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
          className={fieldClass}
        >
          {categoryOptions.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={`booth-status-${booth.id}`} className="text-xs font-medium text-ink">
          Status booth
        </label>
        <select
          id={`booth-status-${booth.id}`}
          value={booth.status}
          onChange={(event) => {
            updateBoothStatus(booth.id, event.target.value as BoothStatus)
            markDirty()
          }}
          aria-describedby={`booth-status-hint-${booth.id}`}
          className={fieldClass}
        >
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {statusLabel[status]}
            </option>
          ))}
        </select>
        <p id={`booth-status-hint-${booth.id}`} className="mt-1 text-[11px] text-muted">
          Status langsung tampil di kanvas dan disimpan bersama denah.
        </p>
      </div>

      <div>
        <label htmlFor={`booth-price-${booth.id}`} className="text-xs font-medium text-ink">
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
          className={fieldClass}
        />
        <p className="mt-1 text-[11px] text-muted">Terbaca sebagai {formatPrice(booth.price)}</p>
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
      aria-label={`Tarik booth kategori ${categoryLabel[template.category]}`}
      className={`cursor-grab touch-none select-none rounded-[8px] border p-3 transition-colors hover:border-pine focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:cursor-grabbing motion-reduce:transition-none ${
        isDragging ? 'border-pine bg-pine-soft opacity-60' : 'border-line bg-surface'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] bg-canvas text-pine">
          {categoryIcon[template.category]}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{categoryLabel[template.category]}</p>
          <p className="text-xs tabular-nums text-muted">
            {template.width} × {template.height} px
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
        <span className="text-xs font-medium tabular-nums text-ink">
          {formatPrice(template.price)}
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-pine">
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-3 w-3">
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
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useEffect(() => {
    setConfirmingDelete(false)
  }, [activeBooth?.id])

  return (
    <aside className="w-full shrink-0 lg:w-72">
      <div className="rounded-[10px] border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold text-ink">Palet booth</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Tarik kategori booth ke area kanvas untuk menempatkannya.
        </p>

        <div className="mt-3 space-y-2.5">
          {boothTemplates.map((template) => (
            <PaletteItem key={template.category} template={template} />
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-[10px] border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold text-ink">Detail booth</h2>

        {activeBooth ? (
          <div className="mt-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">
                  {categoryLabel[activeBooth.category]}
                </p>
                <p className="text-xs tabular-nums text-muted">ID: {activeBooth.id.slice(0, 8)}</p>
              </div>
              <span
                className={`shrink-0 rounded-[4px] px-2.5 py-1 text-[11px] font-semibold ${BOOTH_STATUS_META[activeBooth.status].badge}`}
              >
                {statusLabel[activeBooth.status]}
              </span>
            </div>

            <BoothProperties key={activeBooth.id} booth={activeBooth} />

            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-[6px] border border-line bg-canvas p-2">
                <dt className="text-[10px] uppercase tracking-[0.1em] text-muted">Harga</dt>
                <dd className="mt-0.5 font-semibold tabular-nums text-ink">
                  {formatPrice(activeBooth.price)}
                </dd>
              </div>
              <div className="rounded-[6px] border border-line bg-canvas p-2">
                <dt className="text-[10px] uppercase tracking-[0.1em] text-muted">Ukuran</dt>
                <dd className="mt-0.5 font-semibold tabular-nums text-ink">
                  {activeBooth.width} × {activeBooth.height}
                </dd>
              </div>
              <div className="rounded-[6px] border border-line bg-canvas p-2">
                <dt className="text-[10px] uppercase tracking-[0.1em] text-muted">Posisi X</dt>
                <dd className="mt-0.5 font-semibold tabular-nums text-ink">
                  {Math.round(activeBooth.positionX)} px
                </dd>
              </div>
              <div className="rounded-[6px] border border-line bg-canvas p-2">
                <dt className="text-[10px] uppercase tracking-[0.1em] text-muted">Posisi Y</dt>
                <dd className="mt-0.5 font-semibold tabular-nums text-ink">
                  {Math.round(activeBooth.positionY)} px
                </dd>
              </div>
            </dl>

            <p className="mt-3 text-[11px] leading-relaxed text-muted">
              Perubahan kategori, status, dan harga langsung diterapkan ke state. Klik “Simpan
              Perubahan Denah” untuk menyimpannya permanen.
            </p>

            <div className="mt-4 border-t border-line pt-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                Aksi berisiko
              </p>

              {confirmingDelete ? (
                <InlineConfirm
                  id="delete-booth"
                  title="Hapus booth ini?"
                  description="Booth dihapus dari kanvas draf. Simpan denah untuk menerapkan perubahan."
                  confirmLabel="Ya, hapus"
                  onConfirm={() => {
                    removeBooth(activeBooth.id)
                    setConfirmingDelete(false)
                  }}
                  onCancel={() => setConfirmingDelete(false)}
                  className="mt-2 rounded-[6px] border border-danger bg-danger-soft p-3"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-[6px] border border-danger bg-surface px-4 py-2 text-sm font-semibold text-danger-dark transition-colors hover:bg-danger-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2 focus-visible:ring-offset-surface motion-reduce:transition-none"
                >
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                    className="h-4 w-4"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482 41.03 41.03 0 0 0-2.365-.298V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Hapus booth
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Klik salah satu booth di kanvas untuk melihat detail dan posisi spasialnya.
          </p>
        )}
      </div>

      <div className="mt-4 rounded-[8px] border border-line bg-pine-soft p-4">
        <p className="text-xs font-semibold text-pine-dark">Snap-to-grid aktif</p>
        <p className="mt-1 text-xs leading-relaxed text-pine-dark">
          Booth otomatis menempel pada grid 20 px agar tata letak tetap rapi dan presisi.
        </p>
      </div>
    </aside>
  )
}
