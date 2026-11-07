import { describe, expect, it } from 'vitest'
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  getBookingErrorMessage,
} from './booking'

describe('formatCurrency', () => {
  it('memformat angka sebagai rupiah tanpa desimal', () => {
    expect(formatCurrency(150_000)).toMatch(/Rp\s?150\.000/)
    expect(formatCurrency(1_250_000)).toMatch(/Rp\s?1\.250\.000/)
  })

  it('menampilkan nol sebagai rupiah', () => {
    expect(formatCurrency(0)).toMatch(/Rp\s?0/)
  })
})

describe('formatDateTime', () => {
  it('memformat tanggal dan waktu memakai locale id-ID', () => {
    const iso = '2026-11-05T10:30:00+07:00'
    const expected = new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))

    expect(formatDateTime(iso)).toBe(expected)
    expect(formatDateTime(iso)).toContain('2026')
  })

  it('mengembalikan tanda pisah untuk nilai kosong', () => {
    expect(formatDateTime(null)).toBe('—')
  })

  it('mengembalikan tanda pisah untuk tanggal tidak valid', () => {
    expect(formatDateTime('bukan-tanggal')).toBe('—')
  })
})

describe('formatDate', () => {
  it('memformat tanggal tanpa waktu', () => {
    const iso = '2026-11-05T10:30:00+07:00'
    const expected = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(
      new Date(iso),
    )

    expect(formatDate(iso)).toBe(expected)
  })

  it('mengembalikan tanda pisah untuk nilai kosong atau tidak valid', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate('tidak-valid')).toBe('—')
  })
})

describe('getBookingErrorMessage', () => {
  it('menjelaskan tabel yang belum tersedia', () => {
    const message = getBookingErrorMessage(
      new Error('relation "bookings" does not exist'),
    )

    expect(message).toBe(
      'Tabel pemesanan belum tersedia. Jalankan migrasi pemesanan terlebih dahulu.',
    )
  })

  it('menjelaskan fungsi RPC yang belum tersedia', () => {
    const message = getBookingErrorMessage(
      new Error('function public.create_booking does not exist'),
    )

    expect(message).toBe(
      'Fungsi pemesanan belum tersedia. Jalankan migrasi pemesanan terlebih dahulu.',
    )
  })

  it('menjelaskan kegagalan row-level security', () => {
    const message = getBookingErrorMessage(
      new Error('new row violates row-level security policy'),
    )

    expect(message).toBe('Anda tidak memiliki akses untuk tindakan ini.')
  })

  it('meneruskan pesan error lain apa adanya', () => {
    expect(getBookingErrorMessage(new Error('Booth sudah tidak tersedia.'))).toBe(
      'Booth sudah tidak tersedia.',
    )
  })

  it('menangani error non-Error dan nilai kosong', () => {
    expect(getBookingErrorMessage('gagal jaringan')).toBe('gagal jaringan')
    expect(getBookingErrorMessage(null)).toBe(
      'Terjadi kesalahan saat memproses pemesanan.',
    )
  })
})
