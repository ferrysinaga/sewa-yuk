import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc, state } = vi.hoisted(() => ({
  rpc: vi.fn(),
  state: { configured: true },
}))

vi.mock('./supabase', () => ({
  get isSupabaseConfigured() {
    return state.configured
  },
  supabase: { rpc },
}))

import { sweepExpiredBookings } from './bookingExpiry'

describe('sweepExpiredBookings', () => {
  beforeEach(() => {
    rpc.mockReset()
    state.configured = true
  })

  it('mengembalikan jumlah booking yang dilepas', async () => {
    rpc.mockResolvedValue({ data: 3, error: null })

    await expect(sweepExpiredBookings()).resolves.toBe(3)
    expect(rpc).toHaveBeenCalledWith('release_expired_bookings')
  })

  it('mengubah data string atau null menjadi angka', async () => {
    rpc.mockResolvedValueOnce({ data: '2', error: null })
    await expect(sweepExpiredBookings()).resolves.toBe(2)

    rpc.mockResolvedValueOnce({ data: null, error: null })
    await expect(sweepExpiredBookings()).resolves.toBe(0)
  })

  it('mengembalikan null dan mencatat error RPC tanpa melempar', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    rpc.mockResolvedValue({ data: null, error: { message: 'permission denied' } })

    await expect(sweepExpiredBookings()).resolves.toBeNull()
    expect(warn).toHaveBeenCalledWith('Gagal melepas booking kedaluwarsa:', 'permission denied')
  })

  it('mengembalikan null saat pemanggilan RPC melempar exception', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const failure = new Error('jaringan putus')
    rpc.mockRejectedValue(failure)

    await expect(sweepExpiredBookings()).resolves.toBeNull()
    expect(warn).toHaveBeenCalledWith('Gagal memanggil release_expired_bookings:', failure)
  })

  it('tidak memanggil RPC saat Supabase belum dikonfigurasi', async () => {
    state.configured = false

    await expect(sweepExpiredBookings()).resolves.toBeNull()
    expect(rpc).not.toHaveBeenCalled()
  })
})
