import type { BoothCategory, BoothStatus } from '../types/booth'

export const BOOTH_CATEGORY_LABEL: Record<BoothCategory, string> = {
  Tech: 'Teknologi',
  'F&B': 'F&B',
  Apparel: 'Pakaian',
}

export const BOOTH_CATEGORY_OPTIONS: BoothCategory[] = ['Tech', 'F&B', 'Apparel']

export const BOOTH_STATUS_LABEL: Record<BoothStatus, string> = {
  Available: 'Tersedia',
  Reserved: 'Dipesan',
  Booked: 'Terisi',
}

interface BoothStatusMeta {
  label: string
  dot: string
  badge: string
  bar: string
}

/**
 * Kelas visual status booth untuk tampilan organizer. Peta tenant sengaja
 * memakai badge Reserved yang netral/dashed (lihat statusBadgeClass di
 * TenantSidebar) agar penyewa tidak mengira booth tersedia.
 */
export const BOOTH_STATUS_META: Record<BoothStatus, BoothStatusMeta> = {
  Available: {
    label: BOOTH_STATUS_LABEL.Available,
    dot: 'bg-pine',
    badge: 'border border-line bg-pine-soft text-pine',
    bar: 'bg-pine',
  },
  Reserved: {
    label: BOOTH_STATUS_LABEL.Reserved,
    dot: 'bg-clay',
    badge: 'border border-line bg-clay-soft text-clay-dark',
    bar: 'bg-clay',
  },
  Booked: {
    label: BOOTH_STATUS_LABEL.Booked,
    dot: 'bg-ink',
    badge: 'border border-line bg-unavailable-deep text-ink',
    bar: 'bg-ink',
  },
}

export function getBoothCategoryLabel(category: BoothCategory | 'all'): string {
  return category === 'all' ? 'Semua' : BOOTH_CATEGORY_LABEL[category]
}

export { formatPrice } from './currency'
