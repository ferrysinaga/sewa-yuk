export type BlueprintStatus = 'draft' | 'published' | 'archived'

export interface BlueprintRow {
  id: string
  name: string
  venue: string | null
  event_date: string | null
  description: string | null
  status: BlueprintStatus
  image_url: string | null
  image_path: string | null
}

export interface BlueprintDraft {
  name: string
  venue: string
  eventDate: string
  description: string
  status: BlueprintStatus
  imageUrl: string
  imagePath: string
}

export const BLUEPRINT_STATUS_OPTIONS: BlueprintStatus[] = ['draft', 'published', 'archived']

export const BLUEPRINT_STATUS_LABEL: Record<BlueprintStatus, string> = {
  draft: 'Draft',
  published: 'Dipublikasikan',
  archived: 'Diarsipkan',
}

export const BLUEPRINT_STATUS_BADGE: Record<BlueprintStatus, string> = {
  draft: 'bg-amber-50 text-amber-700 ring-amber-100',
  published: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  archived: 'bg-gray-100 text-gray-600 ring-gray-200',
}

export function isBlueprintStatus(value: unknown): value is BlueprintStatus {
  return value === 'draft' || value === 'published' || value === 'archived'
}
