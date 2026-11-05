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
  draft: 'bg-clay-soft text-clay-dark ring-line',
  published: 'bg-pine-soft text-pine-dark ring-line',
  archived: 'bg-unavailable text-muted ring-line',
}

export function isBlueprintStatus(value: unknown): value is BlueprintStatus {
  return value === 'draft' || value === 'published' || value === 'archived'
}
