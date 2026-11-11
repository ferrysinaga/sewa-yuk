import { describe, expect, it } from 'vitest'
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatRemaining,
  getBookingErrorMessage,
  getRemainingMs,
  isExpiredBooking,
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
    const expected = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(iso))

    expect(formatDate(iso)).toBe(expected)
  })

  it('mengembalikan tanda pisah untuk nilai kosong atau tidak valid', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate('tidak-valid')).toBe('—')
  })
})

describe('getRemainingMs', () => {
  const now = new Date('2026-11-07T10:00:00.000Z').getTime()

  it('menghitung sisa waktu terhadap waktu acuan', () => {
    expect(getRemainingMs('2026-11-07T10:00:10.000Z', now)).toBe(10_000)
    expect(getRemainingMs('2026-11-07T09:59:50.000Z', now)).toBe(-10_000)
  })

  it('mengembalikan null untuk batas kosong atau tidak valid', () => {
    expect(getRemainingMs(null, now)).toBeNull()
    expect(getRemainingMs('bukan-tanggal', now)).toBeNull()
  })
})

describe('formatRemaining', () => {
  it('memformat durasi sebagai jam, menit, dan detik', () => {
    expect(formatRemaining(3_600_000)).toBe('01:00:00')
    expect(formatRemaining(86_381_000)).toBe('23:59:41')
    expect(formatRemaining(59_400)).toBe('00:01:00')
  })

  it('menampilkan Kedaluwarsa saat waktu habis', () => {
    expect(formatRemaining(0)).toBe('Kedaluwarsa')
    expect(formatRemaining(-1)).toBe('Kedaluwarsa')
  })

  it('menampilkan tanda pisah bila batas tidak tersedia', () => {
    expect(formatRemaining(null)).toBe('—')
  })
})

describe('isExpiredBooking', () => {
  const now = new Date('2026-11-07T10:00:00.000Z').getTime()

  it('menandai pending yang batasnya sudah lewat', () => {
    expect(
      isExpiredBooking(
        { status: 'pending', cancelled_reason: null, expires_at: '2026-11-07T09:59:59.000Z' },
        now,
      ),
    ).toBe(true)
    expect(
      isExpiredBooking(
        { status: 'pending', cancelled_reason: null, expires_at: '2026-11-07T10:00:01.000Z' },
        now,
      ),
    ).toBe(false)
  })

  it('hanya menandai cancelled yang alasannya expired', () => {
    expect(
      isExpiredBooking({ status: 'cancelled', cancelled_reason: 'expired', expires_at: null }, now),
    ).toBe(true)
    expect(
      isExpiredBooking({ status: 'cancelled', cancelled_reason: 'manual', expires_at: null }, now),
    ).toBe(false)
  })

  it('tidak menandai awaiting_confirmation sebagai kedaluwarsa', () => {
    expect(
      isExpiredBooking(
        {
          status: 'awaiting_confirmation',
          cancelled_reason: null,
          expires_at: '2026-11-07T09:00:00.000Z',
        },
        now,
      ),
    ).toBe(false)
  })
})

describe('getBookingErrorMessage', () => {
  it('menjelaskan tabel yang belum tersedia', () => {
    const message = getBookingErrorMessage(new Error('relation "bookings" does not exist'))

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
    const message = getBookingErrorMessage(new Error('new row violates row-level security policy'))

    expect(message).toBe('Anda tidak memiliki akses untuk tindakan ini.')
  })

  it.each([
    ['SWY_AUTH_REQUIRED', 'Silakan masuk terlebih dahulu untuk memesan booth.'],
    ['SWY_INVALID_PAYMENT_METHOD', 'Metode pembayaran tidak valid.'],
    ['SWY_BOOTH_NOT_FOUND', 'Booth tidak ditemukan. Muat ulang denah event.'],
    ['SWY_BOOTH_UNAVAILABLE', 'Booth sudah tidak tersedia. Silakan pilih booth lain.'],
    ['SWY_EVENT_NOT_PUBLISHED', 'Event ini belum dipublikasikan.'],
    ['SWY_BOOKING_NOT_FOUND', 'Pemesanan tidak ditemukan. Muat ulang halaman Pesanan Saya.'],
    ['SWY_NOT_OWNER', 'Anda tidak berhak mengubah pemesanan ini.'],
    ['SWY_FORBIDDEN', 'Anda tidak memiliki akses untuk tindakan ini.'],
    ['SWY_ALREADY_PAID', 'Pemesanan ini sudah dibayar dan dikonfirmasi.'],
    ['SWY_BOOKING_EXPIRED', 'Pemesanan sudah kedaluwarsa. Booth telah dilepas untuk penyewa lain.'],
    ['SWY_BOOKING_CANCELLED', 'Pemesanan ini sudah dibatalkan.'],
    ['SWY_INVALID_STATE', 'Status pemesanan tidak memungkinkan tindakan ini. Muat ulang halaman.'],
  ])('memetakan hint %s ke pesan pengguna', (hint, expected) => {
    const message = getBookingErrorMessage({
      code: 'P0001',
      message: 'pesan mentah dari database',
      hint,
    })

    expect(message).toBe(expected)
  })

  it('memakai hint sebagai sumber utama, bukan pesan mentah', () => {
    const message = getBookingErrorMessage({
      code: 'P0001',
      message: 'Booth sudah tidak tersedia. Silakan pilih booth lain.',
      hint: 'SWY_ALREADY_PAID',
    })

    expect(message).toBe('Pemesanan ini sudah dibayar dan dikonfirmasi.')
  })

  it.each([
    ['23505', 'Booth sudah tidak tersedia. Silakan pilih booth lain.'],
    ['42501', 'Anda tidak memiliki akses untuk tindakan ini.'],
    ['P0002', 'Pemesanan tidak ditemukan. Muat ulang halaman Pesanan Saya.'],
    ['22023', 'Metode pembayaran tidak valid.'],
  ])('memetakan SQLSTATE %s saat hint tidak tersedia', (code, expected) => {
    const message = getBookingErrorMessage({ code, message: 'raw database error' })

    expect(message).toBe(expected)
  })

  it('meneruskan pesan error lain apa adanya', () => {
    expect(getBookingErrorMessage(new Error('Booth sudah tidak tersedia.'))).toBe(
      'Booth sudah tidak tersedia.',
    )
  })

  it('menangani error non-Error dan nilai kosong', () => {
    expect(getBookingErrorMessage('gagal jaringan')).toBe('gagal jaringan')
    expect(getBookingErrorMessage(null)).toBe('Terjadi kesalahan saat memproses pemesanan.')
  })
})
