import { getErrorMessage, isNetworkError } from './errors'
import { createId } from './id'
import { supabase } from './supabase'

export const BLUEPRINT_IMAGE_BUCKET = 'blueprint-assets'
export const BLUEPRINT_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const BLUEPRINT_IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp'

const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

export interface UploadedBlueprintImage {
  path: string
  url: string
}

export function validateBlueprintImage(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return 'Format gambar harus JPG, PNG, atau WEBP.'
  }

  if (file.size === 0) {
    return 'File gambar kosong. Pilih gambar lain.'
  }

  if (file.size > BLUEPRINT_IMAGE_MAX_BYTES) {
    return 'Ukuran gambar maksimal 5 MB. Kompres gambar terlebih dahulu.'
  }

  return null
}

function getImageExtension(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase()

  if (extension === 'png' || extension === 'jpg' || extension === 'jpeg' || extension === 'webp') {
    return extension === 'jpeg' ? 'jpg' : extension
  }

  return EXTENSION_BY_TYPE[file.type] ?? 'png'
}

function getBlueprintFolder(blueprintId: string) {
  return blueprintId.replace(/[^a-zA-Z0-9_-]/g, '-') || 'tanpa-id'
}

export async function uploadBlueprintImage(
  blueprintId: string,
  file: File,
): Promise<UploadedBlueprintImage> {
  const path = `blueprints/${getBlueprintFolder(blueprintId)}/${Date.now()}-${createId()}.${getImageExtension(file)}`

  const { error } = await supabase.storage.from(BLUEPRINT_IMAGE_BUCKET).upload(path, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: false,
  })

  if (error) throw error

  const { data } = supabase.storage.from(BLUEPRINT_IMAGE_BUCKET).getPublicUrl(path)

  return { path, url: data.publicUrl }
}

export async function removeBlueprintImage(path: string) {
  if (!path) return

  const { error } = await supabase.storage.from(BLUEPRINT_IMAGE_BUCKET).remove([path])

  if (error) throw error
}

export function getBlueprintImageErrorMessage(error: unknown): string {
  const message = getErrorMessage(error, '')

  if (/bucket not found|bucket.*does not exist/i.test(message)) {
    return 'Bucket gambar belum tersedia. Jalankan migrasi gambar denah terlebih dahulu.'
  }

  if (/row-level security|permission denied|not authorized/i.test(message)) {
    return 'Akun Anda tidak memiliki izin mengunggah gambar. Pastikan akun memiliki role organizer.'
  }

  if (/payload too large|exceeded the maximum|file size/i.test(message)) {
    return 'Ukuran gambar melebihi batas 5 MB.'
  }

  if (/mime type|not supported/i.test(message)) {
    return 'Format gambar tidak didukung. Gunakan JPG, PNG, atau WEBP.'
  }

  if (isNetworkError(message)) {
    return 'Tidak dapat terhubung ke penyimpanan gambar. Periksa koneksi internet Anda.'
  }

  return message || 'Terjadi kesalahan saat mengunggah gambar.'
}
