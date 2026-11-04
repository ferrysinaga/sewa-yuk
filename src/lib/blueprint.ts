import type { BlueprintDraft, BlueprintRow } from '../types/blueprint'
import { isBlueprintStatus } from '../types/blueprint'

export function mapBlueprintRowToDraft(row: BlueprintRow): BlueprintDraft {
  return {
    name: row.name,
    venue: row.venue ?? '',
    eventDate: row.event_date ?? '',
    description: row.description ?? '',
    status: isBlueprintStatus(row.status) ? row.status : 'draft',
  }
}

export function slugifyBlueprintName(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

export function isValidBlueprintId(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
}

export function getBlueprintErrorMessage(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String(error.message)
        : String(error)

  if (/could not find the table|relation .* does not exist|schema cache/i.test(message)) {
    return 'Tabel "blueprints" belum tersedia di Supabase. Jalankan migrasi skema terlebih dahulu.'
  }

  if (/column .*status.* does not exist/i.test(message)) {
    return 'Kolom status publikasi belum tersedia. Jalankan migrasi denah terbaru terlebih dahulu.'
  }

  if (/duplicate key|unique constraint|already exists/i.test(message)) {
    return 'ID denah sudah digunakan. Pilih ID lain.'
  }

  if (/row-level security|permission denied|not authorized/i.test(message)) {
    return 'Akun Anda tidak memiliki izin untuk mengelola denah ini. Pastikan akun memiliki role organizer.'
  }

  if (/failed to fetch|network|timeout/i.test(message)) {
    return 'Tidak dapat terhubung ke Supabase. Periksa koneksi internet Anda lalu coba lagi.'
  }

  return message || 'Terjadi kesalahan saat menghubungi Supabase.'
}
