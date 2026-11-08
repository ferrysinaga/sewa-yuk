import { describe, expect, it } from 'vitest'
import { getErrorMessage, isNetworkError } from './errors'

describe('getErrorMessage', () => {
  it('mengambil pesan dari Error', () => {
    expect(getErrorMessage(new Error('Gagal menyimpan.'), 'Fallback')).toBe('Gagal menyimpan.')
  })

  it('mengambil pesan dari string', () => {
    expect(getErrorMessage('  Gagal memuat.  ', 'Fallback')).toBe('Gagal memuat.')
  })

  it('mengambil pesan dari objek { message }', () => {
    expect(
      getErrorMessage({ message: 'relation "bookings" does not exist' }, 'Fallback'),
    ).toBe('relation "bookings" does not exist')
  })

  it('memakai fallback untuk null, undefined, dan pesan kosong', () => {
    expect(getErrorMessage(null, 'Fallback')).toBe('Fallback')
    expect(getErrorMessage(undefined, 'Fallback')).toBe('Fallback')
    expect(getErrorMessage('', 'Fallback')).toBe('Fallback')
    expect(getErrorMessage({}, 'Fallback')).toBe('Fallback')
  })
})

describe('isNetworkError', () => {
  it('mengenali pola kegagalan jaringan', () => {
    expect(isNetworkError('Failed to fetch')).toBe(true)
    expect(isNetworkError('NetworkError when attempting to fetch resource.')).toBe(true)
    expect(isNetworkError('Request timeout')).toBe(true)
    expect(isNetworkError('Load failed')).toBe(true)
  })

  it('tidak menandai pesan domain biasa', () => {
    expect(isNetworkError('Booth sudah tidak tersedia.')).toBe(false)
  })
})
