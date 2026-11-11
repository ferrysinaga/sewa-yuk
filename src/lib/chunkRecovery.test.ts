import { beforeEach, describe, expect, it } from 'vitest'
import {
  CHUNK_RELOAD_KEY,
  clearChunkReloadMarker,
  hasChunkReloadAttempted,
  isChunkLoadError,
  markChunkReloadAttempted,
} from './chunkRecovery'

describe('isChunkLoadError', () => {
  it('mengenali pesan kegagalan chunk dari browser umum', () => {
    expect(
      isChunkLoadError(new Error('Failed to fetch dynamically imported module: /assets/admin.js')),
    ).toBe(true)
    expect(isChunkLoadError(new Error('Importing a module script failed.'))).toBe(true)
    expect(isChunkLoadError(new Error('error loading dynamically imported module'))).toBe(true)
    expect(isChunkLoadError(new Error('Loading chunk 42 failed'))).toBe(true)
  })

  it('mengenali error bernama ChunkLoadError', () => {
    const error = new Error('gagal memuat')
    error.name = 'ChunkLoadError'

    expect(isChunkLoadError(error)).toBe(true)
  })

  it('mengabaikan error yang bukan kegagalan chunk', () => {
    expect(isChunkLoadError(new Error('render gagal'))).toBe(false)
    expect(isChunkLoadError('bukan error')).toBe(false)
    expect(isChunkLoadError(null)).toBe(false)
  })
})

describe('penanda auto-reload', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('hanya mengizinkan auto-reload sekali', () => {
    expect(hasChunkReloadAttempted(sessionStorage)).toBe(false)
    expect(markChunkReloadAttempted(sessionStorage)).toBe(true)
    expect(sessionStorage.getItem(CHUNK_RELOAD_KEY)).toBe('1')
    expect(hasChunkReloadAttempted(sessionStorage)).toBe(true)
    expect(markChunkReloadAttempted(sessionStorage)).toBe(false)
  })

  it('menghapus penanda setelah halaman berhasil dipulihkan', () => {
    markChunkReloadAttempted(sessionStorage)
    clearChunkReloadMarker(sessionStorage)

    expect(sessionStorage.getItem(CHUNK_RELOAD_KEY)).toBeNull()
    expect(hasChunkReloadAttempted(sessionStorage)).toBe(false)
    expect(markChunkReloadAttempted(sessionStorage)).toBe(true)
  })

  it('tidak melempar saat storage tidak tersedia atau diblokir', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    } as unknown as Storage

    expect(hasChunkReloadAttempted(null)).toBe(false)
    expect(hasChunkReloadAttempted(blocked)).toBe(false)
    expect(markChunkReloadAttempted(null)).toBe(false)
    expect(markChunkReloadAttempted(blocked)).toBe(false)
    expect(() => clearChunkReloadMarker(blocked)).not.toThrow()
  })
})
