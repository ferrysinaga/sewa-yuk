import { describe, expect, it } from 'vitest'
import { applyBookingChange } from './bookingRealtime'
import type { BookingRow } from '../types/booking'

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
    reserved_at: '2026-11-07T10:00:00+07:00',
    expires_at: '2026-11-08T10:00:00+07:00',
    paid_at: null,
    cancelled_at: null,
    cancelled_reason: null,
    created_at: '2026-11-07T10:00:00+07:00',
    updated_at: '2026-11-07T10:00:00+07:00',
    ...overrides,
  }
}

describe('applyBookingChange', () => {
  it('INSERT menambahkan booking baru di depan daftar', () => {
    const existing = makeBooking()
    const inserted = makeBooking({ id: 'booking-2', booking_code: 'BK-002' })

    expect(applyBookingChange([existing], { eventType: 'INSERT', new: inserted })).toEqual([
      inserted,
      existing,
    ])
  })

  it('UPDATE mengganti booking yang ada tanpa mengubah urutan', () => {
    const first = makeBooking({ id: 'booking-1' })
    const second = makeBooking({ id: 'booking-2', booking_code: 'BK-002' })
    const updated = makeBooking({ id: 'booking-2', booking_code: 'BK-002', status: 'confirmed' })

    expect(applyBookingChange([first, second], { eventType: 'UPDATE', new: updated })).toEqual([
      first,
      updated,
    ])
  })

  it('UPDATE dengan row parsial mempertahankan field lain', () => {
    const existing = makeBooking()
    const partial = { id: 'booking-1', status: 'confirmed' as const }

    const [result] = applyBookingChange([existing], {
      eventType: 'UPDATE',
      new: partial,
    })

    expect(result).toEqual({ ...existing, status: 'confirmed' })
    expect(result.tenant_name).toBe('Tenant Satu')
    expect(result.price).toBe(4_500_000)
  })

  it('UPDATE untuk id baru menambahkan booking di depan', () => {
    const existing = makeBooking()
    const incoming = makeBooking({ id: 'booking-3', booking_code: 'BK-003' })

    expect(applyBookingChange([existing], { eventType: 'UPDATE', new: incoming })).toEqual([
      incoming,
      existing,
    ])
  })

  it('DELETE menghapus booking berdasarkan old.id', () => {
    const first = makeBooking({ id: 'booking-1' })
    const second = makeBooking({ id: 'booking-2', booking_code: 'BK-002' })

    expect(
      applyBookingChange([first, second], {
        eventType: 'DELETE',
        old: { id: 'booking-1' },
      }),
    ).toEqual([second])
  })

  it('mengembalikan daftar yang sama bila id payload tidak tersedia', () => {
    const existing = [makeBooking()]

    expect(applyBookingChange(existing, { eventType: 'DELETE', old: {} })).toBe(existing)
    expect(applyBookingChange(existing, { eventType: 'UPDATE', new: {} })).toBe(existing)
  })
})
