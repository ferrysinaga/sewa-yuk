import { describe, expect, it } from 'vitest'
import { getBlueprintErrorMessage, isValidBlueprintId, slugifyBlueprintName } from './blueprint'

describe('slugifyBlueprintName', () => {
  it('mengubah nama menjadi slug huruf kecil dengan tanda hubung', () => {
    expect(slugifyBlueprintName('Hall A 2026')).toBe('hall-a-2026')
  })

  it('merapikan spasi berlebih dan karakter di tepi', () => {
    expect(slugifyBlueprintName('  Expo   Teknologi  ')).toBe('expo-teknologi')
  })

  it('menghapus aksen dan simbol non-alfanumerik', () => {
    expect(slugifyBlueprintName('Café & Crème')).toBe('cafe-creme')
    expect(slugifyBlueprintName('Pameran!!! Nusantara')).toBe('pameran-nusantara')
  })

  it('membatasi panjang slug maksimal 48 karakter', () => {
    const slug = slugifyBlueprintName('a'.repeat(60))

    expect(slug).toHaveLength(48)
    expect(slug).toBe('a'.repeat(48))
  })

  it('mengembalikan string kosong bila tidak ada karakter valid', () => {
    expect(slugifyBlueprintName('!!!')).toBe('')
    expect(slugifyBlueprintName('   ')).toBe('')
  })
})

describe('isValidBlueprintId', () => {
  it('menerima id huruf kecil dan angka yang dipisahkan tanda hubung tunggal', () => {
    expect(isValidBlueprintId('hall-a')).toBe(true)
    expect(isValidBlueprintId('hall-a-2026')).toBe(true)
    expect(isValidBlueprintId('a')).toBe(true)
    expect(isValidBlueprintId('123')).toBe(true)
  })

  it('menolak id dengan huruf besar, spasi, atau simbol', () => {
    expect(isValidBlueprintId('Hall-A')).toBe(false)
    expect(isValidBlueprintId('hall a')).toBe(false)
    expect(isValidBlueprintId('hall_a')).toBe(false)
    expect(isValidBlueprintId('hall.a')).toBe(false)
  })

  it('menolak tanda hubung di awal, akhir, atau berurutan', () => {
    expect(isValidBlueprintId('-hall')).toBe(false)
    expect(isValidBlueprintId('hall-')).toBe(false)
    expect(isValidBlueprintId('hall--a')).toBe(false)
  })

  it('menolak string kosong', () => {
    expect(isValidBlueprintId('')).toBe(false)
  })
})

describe('getBlueprintErrorMessage', () => {
  it('menjelaskan tabel blueprints yang belum tersedia', () => {
    expect(
      getBlueprintErrorMessage(new Error('relation "blueprints" does not exist')),
    ).toBe(
      'Tabel "blueprints" belum tersedia di Supabase. Jalankan migrasi skema terlebih dahulu.',
    )
  })

  it('menjelaskan id denah yang duplikat', () => {
    expect(
      getBlueprintErrorMessage(new Error('duplicate key value violates unique constraint')),
    ).toBe('ID denah sudah digunakan. Pilih ID lain.')
  })

  it('menjelaskan masalah izin', () => {
    expect(getBlueprintErrorMessage(new Error('permission denied for table blueprints'))).toBe(
      'Akun Anda tidak memiliki izin untuk mengelola denah ini. Pastikan akun memiliki role organizer.',
    )
  })

  it('meneruskan pesan lain dan menangani pesan kosong', () => {
    expect(getBlueprintErrorMessage(new Error('Gagal khusus'))).toBe('Gagal khusus')
    expect(getBlueprintErrorMessage('')).toBe(
      'Terjadi kesalahan saat menghubungi Supabase.',
    )
  })
})
