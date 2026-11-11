import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { BookingRow } from '../types/booking'
import { useExpiredBookingSweep } from './useExpiredBookingSweep'

const NOW = new Date('2026-11-07T10:00:00.000Z').getTime()

function makeBooking(overrides: Partial<BookingRow> = {}): BookingRow {
  return {
    id: 'booking-1',
    booking_code: 'BK-001',
    booth_id: 'booth-1',
    blueprint_id: 'hall-a',
    user_id: 'tenant-1',
    tenant_name: 'Tenant Satu',
    tenant_email: 'tenant@example.com',
    tenant_phone: '08123456789',
    booth_category: 'Tech',
    price: 4_500_000,
    status: 'pending',
    payment_method: 'va',
    reserved_at: '2026-11-06T10:00:00.000Z',
    expires_at: '2026-11-07T10:00:00.000Z',
    paid_at: null,
    cancelled_at: null,
    cancelled_reason: null,
    created_at: '2026-11-06T10:00:00.000Z',
    updated_at: '2026-11-06T10:00:00.000Z',
    ...overrides,
  }
}

describe('useExpiredBookingSweep', () => {
  it('memanggil sweep sekali untuk deadline yang sama', async () => {
    const onSweep = vi.fn().mockResolvedValue(1)
    const onSwept = vi.fn()
    const expired = makeBooking({ expires_at: '2026-11-07T09:59:00.000Z' })

    const { rerender } = renderHook(
      ({ bookings, currentNow }) =>
        useExpiredBookingSweep({ bookings, now: currentNow, onSweep, onSwept }),
      { initialProps: { bookings: [expired], currentNow: NOW } },
    )

    await waitFor(() => expect(onSweep).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(onSwept).toHaveBeenCalledWith(1))

    rerender({ bookings: [expired], currentNow: NOW + 1000 })
    await act(async () => {})

    expect(onSweep).toHaveBeenCalledTimes(1)
  })

  it('memanggil sweep lagi saat deadline booking baru terlewati', async () => {
    const onSweep = vi.fn().mockResolvedValue(2)
    const first = makeBooking({
      id: 'booking-1',
      expires_at: '2026-11-07T09:59:00.000Z',
    })
    const second = makeBooking({
      id: 'booking-2',
      booking_code: 'BK-002',
      expires_at: '2026-11-07T09:59:30.000Z',
    })

    const { rerender } = renderHook(
      ({ bookings, currentNow }) => useExpiredBookingSweep({ bookings, now: currentNow, onSweep }),
      { initialProps: { bookings: [first], currentNow: NOW } },
    )

    await waitFor(() => expect(onSweep).toHaveBeenCalledTimes(1))

    rerender({ bookings: [first, second], currentNow: NOW })

    await waitFor(() => expect(onSweep).toHaveBeenCalledTimes(2))
  })

  it('tidak memanggil sweep sebelum batas pembayaran lewat', async () => {
    const onSweep = vi.fn().mockResolvedValue(0)
    const future = makeBooking({ expires_at: '2026-11-07T11:00:00.000Z' })

    renderHook(() => useExpiredBookingSweep({ bookings: [future], now: NOW, onSweep }))

    await act(async () => {})

    expect(onSweep).not.toHaveBeenCalled()
  })

  it('melaporkan null saat RPC sweep gagal tanpa melempar', async () => {
    const onSweep = vi.fn().mockRejectedValue(new Error('rpc gagal'))
    const onSwept = vi.fn()
    const expired = makeBooking({ expires_at: '2026-11-07T09:59:00.000Z' })

    renderHook(() => useExpiredBookingSweep({ bookings: [expired], now: NOW, onSweep, onSwept }))

    await waitFor(() => expect(onSwept).toHaveBeenCalledWith(null))
  })

  it('tidak memanggil onSwept setelah komponen unmount', async () => {
    let resolveSweep: (value: number | null) => void = () => {}
    const onSweep = vi.fn(
      () =>
        new Promise<number | null>((resolve) => {
          resolveSweep = resolve
        }),
    )
    const onSwept = vi.fn()
    const expired = makeBooking({ expires_at: '2026-11-07T09:59:00.000Z' })

    const { unmount } = renderHook(() =>
      useExpiredBookingSweep({ bookings: [expired], now: NOW, onSweep, onSwept }),
    )

    await waitFor(() => expect(onSweep).toHaveBeenCalledTimes(1))

    unmount()
    await act(async () => resolveSweep(1))

    expect(onSwept).not.toHaveBeenCalled()
  })

  it('mengabaikan booking yang bukan pending meski batasnya lewat', async () => {
    const onSweep = vi.fn().mockResolvedValue(0)
    const confirmed = makeBooking({
      id: 'booking-1',
      status: 'confirmed',
      expires_at: '2026-11-07T09:59:00.000Z',
    })
    const cancelled = makeBooking({
      id: 'booking-2',
      booking_code: 'BK-002',
      status: 'cancelled',
      cancelled_reason: 'expired',
      expires_at: '2026-11-07T09:59:00.000Z',
    })

    renderHook(() =>
      useExpiredBookingSweep({ bookings: [confirmed, cancelled], now: NOW, onSweep }),
    )

    await act(async () => {})

    expect(onSweep).not.toHaveBeenCalled()
  })

  it('memanggil sweep lagi saat expires_at booking yang sama berubah', async () => {
    const onSweep = vi.fn().mockResolvedValue(1)
    const first = makeBooking({ expires_at: '2026-11-07T09:58:00.000Z' })
    const movedDeadline = makeBooking({ expires_at: '2026-11-07T09:59:00.000Z' })

    const { rerender } = renderHook(
      ({ bookings }) => useExpiredBookingSweep({ bookings, now: NOW, onSweep }),
      { initialProps: { bookings: [first] } },
    )

    await waitFor(() => expect(onSweep).toHaveBeenCalledTimes(1))

    rerender({ bookings: [movedDeadline] })

    await waitFor(() => expect(onSweep).toHaveBeenCalledTimes(2))
  })

  it('memakai callback sweep terbaru tanpa membuat ulang penanda', async () => {
    const firstSweep = vi.fn().mockResolvedValue(1)
    const secondSweep = vi.fn().mockResolvedValue(2)
    const onSwept = vi.fn()
    const first = makeBooking({ expires_at: '2026-11-07T09:58:00.000Z' })
    const second = makeBooking({
      id: 'booking-2',
      booking_code: 'BK-002',
      expires_at: '2026-11-07T09:59:00.000Z',
    })

    const { rerender } = renderHook(
      ({ bookings, onSweep }) => useExpiredBookingSweep({ bookings, now: NOW, onSweep, onSwept }),
      { initialProps: { bookings: [first], onSweep: firstSweep } },
    )

    await waitFor(() => expect(onSwept).toHaveBeenCalledWith(1))

    rerender({ bookings: [first, second], onSweep: secondSweep })

    await waitFor(() => expect(onSwept).toHaveBeenCalledWith(2))
    expect(firstSweep).toHaveBeenCalledTimes(1)
    expect(secondSweep).toHaveBeenCalledTimes(1)
  })
})
