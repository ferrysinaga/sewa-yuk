import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TenantBookingCard from './TenantBookingCard'
import type { BookingRow } from '../../../types/booking'
import type { TenantBookingsState } from './useTenantBookings'

const NOW = new Date('2026-11-16T10:00:00Z').getTime()
const IN_TWO_HOURS = new Date(NOW + 2 * 60 * 60 * 1000).toISOString()
const TWO_HOURS_AGO = new Date(NOW - 2 * 60 * 60 * 1000).toISOString()

function makeBooking(overrides: Partial<BookingRow> = {}): BookingRow {
  return {
    id: 'booking-1',
    booking_code: 'SWY-001',
    booth_id: 'booth-12345678',
    blueprint_id: 'bp-1',
    user_id: 'user-1',
    tenant_name: 'Tenant Satu',
    tenant_email: 'tenant@example.com',
    tenant_phone: '08123456789',
    booth_category: 'F&B',
    price: 1_500_000,
    status: 'pending',
    payment_method: 'va',
    reserved_at: IN_TWO_HOURS,
    expires_at: IN_TWO_HOURS,
    paid_at: null,
    cancelled_at: null,
    cancelled_reason: null,
    created_at: IN_TWO_HOURS,
    updated_at: IN_TWO_HOURS,
    ...overrides,
  }
}

function makeState(): TenantBookingsState {
  return {
    blueprintById: new Map([
      [
        'bp-1',
        {
          id: 'bp-1',
          name: 'Festival Kuliner Merdeka',
          venue: 'Hall B',
          event_date: '2026-12-01',
        },
      ],
    ]),
    now: NOW,
    updatingId: null,
    confirmingCancelId: null,
    setConfirmingCancelId: vi.fn(),
    handleMarkPaid: vi.fn(),
    handleCancel: vi.fn(),
  } as unknown as TenantBookingsState
}

describe('TenantBookingCard', () => {
  it('menampilkan countdown yang bisa dibaca pembaca layar pada booking pending', () => {
    render(<TenantBookingCard booking={makeBooking()} state={makeState()} />)

    expect(screen.getByText('Menunggu Pembayaran')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Saya Sudah Bayar' })).toBeInTheDocument()

    const timer = screen.getByRole('timer')
    expect(timer).toHaveAttribute('aria-live', 'off')
    expect(timer).toHaveAttribute('aria-label', 'Sisa waktu pembayaran 2 jam')
  })

  it('menandai booking menunggu verifikasi tanpa countdown dan tanpa tombol bayar', () => {
    render(
      <TenantBookingCard
        booking={makeBooking({ status: 'awaiting_confirmation', expires_at: TWO_HOURS_AGO })}
        state={makeState()}
      />,
    )

    const badge = screen.getByText('Menunggu Verifikasi')
    expect(badge).toHaveClass('bg-canvas')
    expect(screen.getByText('Batas pembayaran awal')).toBeInTheDocument()
    expect(
      screen.getByText('Batas ini tidak berlaku setelah konfirmasi pembayaran dikirim.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Saya Sudah Bayar' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Batalkan Pesanan' })).toBeInTheDocument()
  })

  it('memakai label Diverifikasi untuk paid_at, bukan Dibayar', () => {
    const { container } = render(
      <TenantBookingCard
        booking={makeBooking({ status: 'confirmed', paid_at: IN_TWO_HOURS })}
        state={makeState()}
      />,
    )

    expect(screen.getByText('Terkonfirmasi')).toBeInTheDocument()
    expect(screen.getByText('Diverifikasi')).toBeInTheDocument()
    expect(container.textContent).not.toContain('Dibayar')
    expect(screen.queryByRole('button', { name: 'Batalkan Pesanan' })).not.toBeInTheDocument()
  })

  it('menampilkan kedaluwarsa tanpa aksi bayar dan tanpa istilah Booked', () => {
    const { container } = render(
      <TenantBookingCard
        booking={makeBooking({ expires_at: TWO_HOURS_AGO })}
        state={makeState()}
      />,
    )

    expect(screen.getAllByText('Kedaluwarsa').length).toBeGreaterThan(0)
    expect(screen.getByText(/Perbarui status/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Saya Sudah Bayar' })).not.toBeInTheDocument()
    expect(container.textContent).not.toContain('Booked')
  })

  it('menjelaskan pembatalan manual dan kedaluwarsa dengan copy berbeda', () => {
    const { container: manual } = render(
      <TenantBookingCard
        booking={makeBooking({
          status: 'cancelled',
          cancelled_reason: 'manual',
          cancelled_at: IN_TWO_HOURS,
        })}
        state={makeState()}
      />,
    )
    const { container: expired } = render(
      <TenantBookingCard
        booking={makeBooking({
          status: 'cancelled',
          cancelled_reason: 'expired',
          cancelled_at: IN_TWO_HOURS,
        })}
        state={makeState()}
      />,
    )

    expect(manual.textContent).toContain('Pesanan dibatalkan. Booth sudah dilepas')
    expect(expired.textContent).toContain('Pesanan kedaluwarsa karena batas pembayaran terlewat')
    expect(manual.textContent).not.toContain('Booked')
    expect(expired.textContent).not.toContain('Booked')
  })
})
