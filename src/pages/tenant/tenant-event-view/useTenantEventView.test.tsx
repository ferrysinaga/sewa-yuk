import { act, renderHook, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_BLUEPRINT_ID, useBoothStore } from '../../../store/useBoothStore'
import { useAuthStore } from '../../../store/useAuthStore'
import type { BookingRow } from '../../../types/booking'
import { useTenantEventView } from './useTenantEventView'

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  rpc: vi.fn(),
  removeChannel: vi.fn(),
  sweepExpiredBookings: vi.fn(),
  load: {
    blueprint: { data: null as unknown, error: null as unknown },
    booths: { data: [] as unknown[], error: null as unknown },
  },
}))

vi.mock('../../../components/ui/Toast', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}))

vi.mock('../../../lib/bookingExpiry', () => ({
  sweepExpiredBookings: mocks.sweepExpiredBookings,
}))

vi.mock('../../../lib/supabase', () => {
  const channel = {
    on: vi.fn(() => channel),
    subscribe: vi.fn(() => channel),
  }

  return {
    isSupabaseConfigured: true,
    supabase: {
      from: vi.fn((table: string) => {
        if (table === 'blueprints') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => mocks.load.blueprint,
              }),
            }),
          }
        }

        return {
          select: () => ({
            eq: async () => mocks.load.booths,
          }),
        }
      }),
      rpc: mocks.rpc,
      channel: vi.fn(() => channel),
      removeChannel: mocks.removeChannel,
    },
  }
})

const BOOTH_ID = '11111111-1111-4111-8111-111111111101'

const boothRow = {
  id: BOOTH_ID,
  blueprint_id: DEFAULT_BLUEPRINT_ID,
  category: 'Tech' as const,
  position_x: 100,
  position_y: 100,
  width: 160,
  height: 120,
  price: 4_500_000,
  status: 'Available' as const,
}

const blueprintRow = {
  id: DEFAULT_BLUEPRINT_ID,
  name: 'Pameran Teknologi',
  venue: 'Hall A',
  event_date: '2026-11-20',
  description: null,
  status: 'published' as const,
  image_url: null,
  image_path: null,
}

const user = {
  id: 'tenant-1',
  email: 'tenant@example.com',
  user_metadata: { role: 'tenant' },
} as unknown as User

const session = { user } as unknown as Session

function makeBooking(overrides: Partial<BookingRow> = {}): BookingRow {
  return {
    id: 'booking-1',
    booking_code: 'BK-001',
    booth_id: BOOTH_ID,
    blueprint_id: DEFAULT_BLUEPRINT_ID,
    user_id: 'tenant-1',
    tenant_name: 'Tenant Satu',
    tenant_email: 'tenant@example.com',
    tenant_phone: '08123456789',
    booth_category: 'Tech',
    price: 4_500_000,
    status: 'pending',
    payment_method: 'va',
    reserved_at: '2026-11-11T10:00:00.000Z',
    expires_at: '2026-11-12T10:00:00.000Z',
    paid_at: null,
    cancelled_at: null,
    cancelled_reason: null,
    created_at: '2026-11-11T10:00:00.000Z',
    updated_at: '2026-11-11T10:00:00.000Z',
    ...overrides,
  }
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={['/event/hall-a']}>
      <Routes>
        <Route path="/event/:eventId" element={<>{children}</>} />
      </Routes>
    </MemoryRouter>
  )
}

async function renderView() {
  const view = renderHook(() => useTenantEventView(), { wrapper })

  await waitFor(() => expect(useBoothStore.getState().booths).toHaveLength(1))

  act(() => useBoothStore.getState().setActiveBooth(BOOTH_ID))

  return view
}

beforeEach(() => {
  mocks.showToast.mockReset()
  mocks.rpc.mockReset()
  mocks.removeChannel.mockReset().mockResolvedValue(undefined)
  mocks.sweepExpiredBookings.mockReset().mockResolvedValue(null)
  mocks.load.blueprint = { data: blueprintRow, error: null }
  mocks.load.booths = { data: [boothRow], error: null }

  useBoothStore.setState({
    booths: [],
    activeBoothId: null,
    blueprintId: DEFAULT_BLUEPRINT_ID,
    blueprintDraft: null,
    blueprintImageUrl: null,
    isDirty: false,
    deletedBoothIds: [],
    boothStatusBaseline: {},
  })

  useAuthStore.setState({
    session,
    user,
    role: 'tenant',
    loading: false,
    initialized: true,
  })
})

describe('useTenantEventView rollback optimistic', () => {
  it('mengembalikan status booth ke Available saat RPC gagal', async () => {
    const { result } = await renderView()
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: 'pesan mentah', hint: 'SWY_BOOTH_UNAVAILABLE' },
    })

    await act(async () => {
      await result.current.handleConfirmCheckout('va')
    })

    expect(useBoothStore.getState().booths[0]?.status).toBe('Available')
    expect(result.current.reserving).toBe(false)
    expect(result.current.reservedBoothId).toBeNull()
    expect(mocks.showToast).toHaveBeenCalledWith(
      'Gagal membuat pesanan: Booth sudah tidak tersedia. Silakan pilih booth lain.',
      'error',
    )
  })

  it('tidak menimpa status yang sudah diubah server saat rollback', async () => {
    const { result } = await renderView()
    let resolveRpc: (value: unknown) => void = () => {}
    mocks.rpc.mockReturnValue(
      new Promise((resolve) => {
        resolveRpc = resolve
      }),
    )

    const pending = result.current.handleConfirmCheckout('va')

    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(1))

    act(() => useBoothStore.getState().updateBoothStatus(BOOTH_ID, 'Booked'))
    resolveRpc({ data: null, error: { message: 'gagal' } })

    await act(async () => {
      await pending
    })

    expect(useBoothStore.getState().booths[0]?.status).toBe('Booked')
  })

  it('mempertahankan status Reserved dan menyimpan booking saat RPC sukses', async () => {
    const { result } = await renderView()
    const booking = makeBooking()
    mocks.rpc.mockResolvedValue({ data: [booking], error: null })

    await act(async () => {
      await result.current.handleConfirmCheckout('va')
    })

    expect(useBoothStore.getState().booths[0]?.status).toBe('Reserved')
    expect(result.current.reservedBoothId).toBe(BOOTH_ID)
    expect(result.current.reservedBooking).toEqual(booking)
    expect(result.current.reserving).toBe(false)
    expect(mocks.showToast).toHaveBeenCalledWith('Pesanan BK-001 berhasil dibuat.', 'success')
  })

  it('rollback saat RPC sukses tetapi tidak mengembalikan booking', async () => {
    const { result } = await renderView()
    mocks.rpc.mockResolvedValue({ data: null, error: null })

    await act(async () => {
      await result.current.handleConfirmCheckout('va')
    })

    expect(useBoothStore.getState().booths[0]?.status).toBe('Available')
    expect(mocks.showToast).toHaveBeenCalledWith(
      'Gagal membuat pesanan: Pemesanan gagal dibuat. Silakan coba lagi.',
      'error',
    )
  })
})
