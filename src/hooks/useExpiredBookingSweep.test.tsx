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
      ({ bookings, currentNow }) =>
        useExpiredBookingSweep({ bookings, now: currentNow, onSweep }),
      { initialProps: { bookings: [first], currentNow: NOW } },
    )

    await waitFor(() => expect(onSweep).toHaveBeenCalledTimes(1))

    rerender({ bookings: [first, second], currentNow: NOW })

    await waitFor(() => expect(onSweep).toHaveBeenCalledTimes(2))
  })

  it('tidak memanggil sweep sebelum batas pembayaran lewat', async () => {
    const onSweep = vi.fn().mockResolvedValue(0)
    const future = makeBooking({ expires_at: '2026-11-07T11:00:00.000Z' })

    renderHook(() =>
      useExpiredBookingSweep({ bookings: [future], now: NOW, onSweep }),
    )

    await act(async () => {})

    expect(onSweep).not.toHaveBeenCalled()
  })
})
