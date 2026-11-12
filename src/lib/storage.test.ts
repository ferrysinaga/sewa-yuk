import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BLUEPRINT_IMAGE_MAX_BYTES,
  getBlueprintImageErrorMessage,
  removeBlueprintImage,
  uploadBlueprintImage,
  validateBlueprintImage,
} from './storage'

const { upload, getPublicUrl, remove } = vi.hoisted(() => ({
  upload: vi.fn(),
  getPublicUrl: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('./supabase', () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({ upload, getPublicUrl, remove })),
    },
  },
}))

function makeFile(type: string, size: number, name = 'cover.png') {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

beforeEach(() => {
  upload.mockReset()
  getPublicUrl.mockReset()
  remove.mockReset()
})

describe('validateBlueprintImage', () => {
  it('menerima PNG, JPEG, dan WEBP yang tidak kosong', () => {
    expect(validateBlueprintImage(makeFile('image/png', 1024))).toBeNull()
    expect(validateBlueprintImage(makeFile('image/jpeg', 1024, 'cover.jpg'))).toBeNull()
    expect(validateBlueprintImage(makeFile('image/webp', 1024, 'cover.webp'))).toBeNull()
  })

  it('menolak tipe di luar daftar bucket', () => {
    expect(validateBlueprintImage(makeFile('image/gif', 1024, 'cover.gif'))).toMatch(
      /JPG, PNG, atau WEBP/,
    )
    expect(validateBlueprintImage(makeFile('image/svg+xml', 1024, 'cover.svg'))).toMatch(
      /JPG, PNG, atau WEBP/,
    )
  })

  it('menolak file kosong dan file di atas 5 MB', () => {
    expect(validateBlueprintImage(makeFile('image/png', 0))).toMatch(/kosong/)
    expect(validateBlueprintImage(makeFile('image/png', BLUEPRINT_IMAGE_MAX_BYTES + 1))).toMatch(
      /maksimal 5 MB/,
    )
  })

  it('menerima file tepat pada batas 5 MB', () => {
    expect(validateBlueprintImage(makeFile('image/png', BLUEPRINT_IMAGE_MAX_BYTES))).toBeNull()
  })
})

describe('uploadBlueprintImage', () => {
  it('memakai folder blueprint yang aman dan ekstensi dari nama file', async () => {
    upload.mockResolvedValue({ error: null })
    getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example/cover.png' } })

    const result = await uploadBlueprintImage(
      'hall a/2026',
      makeFile('image/png', 1024, 'COVER.PNG'),
    )

    expect(upload).toHaveBeenCalledTimes(1)
    const [path, file, options] = upload.mock.calls[0]
    expect(path).toMatch(/^blueprints\/hall-a-2026\/\d+-[0-9a-f-]{36}\.png$/)
    expect(file).toBeInstanceOf(File)
    expect(options).toEqual({
      cacheControl: '3600',
      contentType: 'image/png',
      upsert: false,
    })
    expect(result).toEqual({ path, url: 'https://cdn.example/cover.png' })
  })

  it('memakai ekstensi dari MIME saat nama file tidak dikenal', async () => {
    upload.mockResolvedValue({ error: null })
    getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example/cover.webp' } })

    await uploadBlueprintImage('hall-a', makeFile('image/webp', 1024, 'cover.bin'))

    expect(upload.mock.calls[0][0]).toMatch(/\.webp$/)
  })

  it('memakai folder cadangan saat blueprint id kosong setelah sanitasi', async () => {
    upload.mockResolvedValue({ error: null })
    getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example/cover.png' } })

    await uploadBlueprintImage('', makeFile('image/png', 1024))

    expect(upload.mock.calls[0][0]).toMatch(/^blueprints\/tanpa-id\//)
  })

  it('meneruskan error upload dan tidak mengembalikan URL', async () => {
    const error = { message: 'new row violates row-level security policy' }
    upload.mockResolvedValue({ error })

    await expect(uploadBlueprintImage('hall-a', makeFile('image/png', 1024))).rejects.toBe(error)
    expect(getPublicUrl).not.toHaveBeenCalled()
  })
})

describe('removeBlueprintImage', () => {
  it('tidak memanggil Storage untuk path kosong', async () => {
    await removeBlueprintImage('')

    expect(remove).not.toHaveBeenCalled()
  })

  it('menghapus satu path dan meneruskan error', async () => {
    remove.mockResolvedValue({ error: null })
    await removeBlueprintImage('blueprints/hall-a/cover.png')
    expect(remove).toHaveBeenCalledWith(['blueprints/hall-a/cover.png'])

    const error = { message: 'not authorized' }
    remove.mockResolvedValue({ error })
    await expect(removeBlueprintImage('blueprints/hall-a/cover.png')).rejects.toBe(error)
  })
})

describe('getBlueprintImageErrorMessage', () => {
  it.each([
    ['Bucket not found', /Bucket gambar belum tersedia/],
    ['new row violates row-level security policy', /tidak memiliki izin/],
    ['The object exceeded the maximum allowed size', /melebihi batas 5 MB/],
    ['mime type image/gif is not supported', /Format gambar tidak didukung/],
    ['Failed to fetch', /Tidak dapat terhubung ke penyimpanan/],
  ])('memetakan pesan %s', (message, expected) => {
    expect(getBlueprintImageErrorMessage({ message })).toMatch(expected)
  })

  it('memakai pesan asli untuk error yang tidak dikenal', () => {
    expect(getBlueprintImageErrorMessage({ message: 'kegagalan lain' })).toBe('kegagalan lain')
  })

  it('memakai fallback untuk nilai kosong', () => {
    expect(getBlueprintImageErrorMessage(null)).toBe('Terjadi kesalahan saat mengunggah gambar.')
  })
})
