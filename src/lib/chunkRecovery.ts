/**
 * Penanda auto-reload sengaja disimpan per sesi tab agar kegagalan memuat
 * chunk tidak memicu reload berulang tanpa akhir.
 */
export const CHUNK_RELOAD_KEY = 'sewa-yuk:chunk-reload-attempted'

const CHUNK_ERROR_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
  /error loading dynamically imported module/i,
  /loading chunk [\w-]+ failed/i,
]

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false

  if (typeof error === 'object' && error !== null) {
    const name = (error as { name?: unknown }).name
    if (name === 'ChunkLoadError') return true
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : ''

  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message))
}

/** Kembalikan true hanya bila reload otomatis belum pernah dicoba. */
export function markChunkReloadAttempted(storage: Storage | null): boolean {
  if (!storage) return false

  try {
    if (storage.getItem(CHUNK_RELOAD_KEY) !== null) return false

    storage.setItem(CHUNK_RELOAD_KEY, '1')
    return true
  } catch {
    return false
  }
}

/** Hapus penanda setelah halaman berhasil dimuat agar deploy berikutnya pulih. */
export function clearChunkReloadMarker(storage: Storage | null): void {
  if (!storage) return

  try {
    storage.removeItem(CHUNK_RELOAD_KEY)
  } catch {
    // sessionStorage dapat diblokir oleh mode privasi; abaikan.
  }
}

export function getSessionStorage(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}
