import { describe, expect, it } from 'vitest'
import {
  AWAITING_DEADLINE_NOTE,
  MARK_PAID_TOAST,
  describeRemainingTime,
  getBookingStatusView,
  getCancelBookingToast,
  getConfirmBookingToast,
  getExpiredSweepToast,
} from './bookingStatus'
import type { BookingRow } from '../types/booking'

const NOW = new Date('2026-11-16T10:00:00Z').getTime()
const IN_ONE_HOUR = new Date(NOW + 60 * 60 * 1000).toISOString()
const ONE_HOUR_AGO = new Date(NOW - 60 * 60 * 1000).toISOString()

type StatusInput = Pick<BookingRow, 'status' | 'cancelled_reason' | 'expires_at'>

function booking(overrides: Partial<StatusInput> = {}): StatusInput {
  return {
    status: 'pending',
    cancelled_reason: null,
    expires_at: IN_ONE_HOUR,
    ...overrides,
  }
}

describe('getBookingStatusView', () => {
  it('menampilkan countdown untuk booking pending yang belum lewat batas', () => {
    const view = getBookingStatusView(booking(), NOW)

    expect(view.key).toBe('pending')
    expect(view.label).toBe('Menunggu Pembayaran')
    expect(view.countdown).toBe('remaining')
    expect(view.showDeadline).toBe(true)
    expect(view.deadlineLabel).toBe('Batas pembayaran')
    expect(view.deadlineTone).toBe('clay')
    expect(view.description).toBeNull()
    expect(view.canCancel).toBe(true)
    expect(view.canMarkPaid).toBe(true)
    expect(view.canConfirm).toBe(true)
  })

  it('mengubah pending yang lewat batas menjadi kedaluwarsa tanpa aksi bayar', () => {
    const view = getBookingStatusView(booking({ expires_at: ONE_HOUR_AGO }), NOW)

    expect(view.key).toBe('pending_expired')
    expect(view.label).toBe('Kedaluwarsa')
    expect(view.countdown).toBe('expired')
    expect(view.deadlineLabel).toBe('Batas pembayaran (terlewat)')
    expect(view.canMarkPaid).toBe(false)
    expect(view.canConfirm).toBe(false)
    expect(view.canCancel).toBe(true)
    expect(view.description).toContain('Perbarui status')
  })

  it('menandai awaiting_confirmation sebagai menunggu organizer tanpa countdown', () => {
    const view = getBookingStatusView(
      booking({ status: 'awaiting_confirmation', expires_at: ONE_HOUR_AGO }),
      NOW,
    )

    expect(view.key).toBe('awaiting_confirmation')
    expect(view.label).toBe('Menunggu Verifikasi')
    expect(view.badge).toBe('bg-canvas text-ink ring-line')
    expect(view.countdown).toBe('none')
    expect(view.deadlineLabel).toBe('Batas pembayaran awal')
    expect(view.deadlineTone).toBe('muted')
    expect(view.canMarkPaid).toBe(false)
    expect(view.canConfirm).toBe(true)
    expect(view.canCancel).toBe(true)
    expect(view.description).toContain('Organizer akan memverifikasi')
  })

  it('menjelaskan booking terkonfirmasi tanpa aksi lanjutan', () => {
    const view = getBookingStatusView(booking({ status: 'confirmed' }), NOW)

    expect(view.key).toBe('confirmed')
    expect(view.label).toBe('Terkonfirmasi')
    expect(view.showDeadline).toBe(false)
    expect(view.description).toContain('Pembayaran terverifikasi')
    expect(view.canCancel).toBe(false)
    expect(view.canMarkPaid).toBe(false)
    expect(view.canConfirm).toBe(false)
  })

  it('membedakan pembatalan manual dari kedaluwarsa', () => {
    const manual = getBookingStatusView(
      booking({ status: 'cancelled', cancelled_reason: 'manual' }),
      NOW,
    )
    const expired = getBookingStatusView(
      booking({ status: 'cancelled', cancelled_reason: 'expired' }),
      NOW,
    )

    expect(manual.key).toBe('cancelled')
    expect(manual.label).toBe('Dibatalkan')
    expect(manual.description).toContain('Pesanan dibatalkan')

    expect(expired.key).toBe('cancelled_expired')
    expect(expired.label).toBe('Kedaluwarsa')
    expect(expired.description).toContain('kedaluwarsa')
    expect(expired.showDeadline).toBe(false)
    expect(expired.canCancel).toBe(false)
  })

  it('tidak membocorkan nama enum ke label pengguna', () => {
    const views = [
      getBookingStatusView(booking(), NOW),
      getBookingStatusView(booking({ expires_at: ONE_HOUR_AGO }), NOW),
      getBookingStatusView(booking({ status: 'awaiting_confirmation' }), NOW),
      getBookingStatusView(booking({ status: 'confirmed' }), NOW),
      getBookingStatusView(booking({ status: 'cancelled', cancelled_reason: 'manual' }), NOW),
      getBookingStatusView(booking({ status: 'cancelled', cancelled_reason: 'expired' }), NOW),
    ]

    for (const view of views) {
      expect(view.label).not.toMatch(/pending|awaiting|confirmed|cancelled|expired/i)
      expect(view.description ?? '').not.toMatch(/pending|awaiting|confirmed|cancelled|expired/i)
    }
  })
})

describe('describeRemainingTime', () => {
  it('menghasilkan kalimat lengkap untuk pembaca layar', () => {
    expect(describeRemainingTime(3 * 60 * 60 * 1000 + 12 * 60 * 1000)).toBe(
      'Sisa waktu pembayaran 3 jam 12 menit',
    )
    expect(describeRemainingTime(5 * 60 * 1000)).toBe('Sisa waktu pembayaran 5 menit')
    expect(describeRemainingTime(2 * 60 * 60 * 1000)).toBe('Sisa waktu pembayaran 2 jam')
  })

  it('membulatkan sisa detik ke menit berikutnya', () => {
    expect(describeRemainingTime(61 * 1000)).toBe('Sisa waktu pembayaran 2 menit')
  })

  it('menangani batas yang lewat atau tidak tersedia', () => {
    expect(describeRemainingTime(0)).toBe('Batas pembayaran sudah lewat')
    expect(describeRemainingTime(-1000)).toBe('Batas pembayaran sudah lewat')
    expect(describeRemainingTime(null)).toBe('Batas pembayaran tidak tersedia')
  })
})

describe('copy toast status booking', () => {
  it('memakai copy tenant untuk pembatalan manual dan kedaluwarsa', () => {
    expect(getCancelBookingToast('manual')).toBe('Pesanan dibatalkan dan booth kembali tersedia.')
    expect(getCancelBookingToast('expired')).toBe('Pesanan kedaluwarsa dan booth kembali tersedia.')
    expect(getCancelBookingToast(null)).toBe('Pesanan dibatalkan dan booth kembali tersedia.')
  })

  it('menyertakan kode pesanan pada copy organizer', () => {
    expect(getCancelBookingToast('manual', { bookingCode: 'SWY-001' })).toBe(
      'Pesanan SWY-001 dibatalkan. Booth kembali tersedia.',
    )
    expect(getCancelBookingToast('expired', { bookingCode: 'SWY-001' })).toBe(
      'Pesanan SWY-001 kedaluwarsa. Booth kembali tersedia.',
    )
  })

  it('memakai istilah booth terisi, bukan nama enum', () => {
    expect(getConfirmBookingToast('SWY-002')).toBe(
      'Pembayaran SWY-002 dikonfirmasi. Booth menjadi terisi.',
    )
    expect(getConfirmBookingToast('SWY-002')).not.toContain('Booked')
  })

  it('menyebut jumlah pesanan pada toast sweep', () => {
    expect(getExpiredSweepToast(3)).toBe(
      '3 pesanan kedaluwarsa dibatalkan dan booth kembali tersedia.',
    )
  })

  it('memakai copy konfirmasi pembayaran yang sama di kartu tenant', () => {
    expect(MARK_PAID_TOAST).toBe('Konfirmasi pembayaran dikirim. Menunggu verifikasi organizer.')
    expect(AWAITING_DEADLINE_NOTE).toBe(
      'Batas ini tidak berlaku setelah konfirmasi pembayaran dikirim.',
    )
  })
})
