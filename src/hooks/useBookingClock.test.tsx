import { act, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isExpiredBooking } from '../lib/booking'
import { useBookingClock } from './useBookingClock'

const START = new Date('2026-11-07T10:00:00.000Z').getTime()

describe('useBookingClock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(START)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('memperbarui waktu setiap detik saat aktif', () => {
    const { result } = renderHook(() => useBookingClock(true))

    expect(result.current).toBe(START)

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(result.current).toBe(START + 1000)
  })

  it('berhenti saat tidak ada booking pending', () => {
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useBookingClock(enabled),
      { initialProps: { enabled: true } },
    )

    rerender({ enabled: false })
    const stoppedAt = result.current

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(result.current).toBe(stoppedAt)
  })

  it('tidak membuat interval saat clock nonaktif', () => {
    renderHook(() => useBookingClock(false))

    expect(vi.getTimerCount()).toBe(0)
  })

  it('membersihkan interval saat komponen unmount', () => {
    const { unmount } = renderHook(() => useBookingClock(true))

    expect(vi.getTimerCount()).toBe(1)

    unmount()

    expect(vi.getTimerCount()).toBe(0)
  })

  it('membersihkan interval lama lalu memulai lagi saat diaktifkan kembali', () => {
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useBookingClock(enabled),
      { initialProps: { enabled: true } },
    )

    rerender({ enabled: false })
    expect(vi.getTimerCount()).toBe(0)

    rerender({ enabled: true })
    expect(vi.getTimerCount()).toBe(1)

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(result.current).toBe(START + 1000)
  })

  it('mengubah status menjadi Kedaluwarsa tepat setelah deadline', () => {
    function StatusProbe() {
      const now = useBookingClock(true)
      const expired = isExpiredBooking(
        {
          status: 'pending',
          cancelled_reason: null,
          expires_at: '2026-11-07T10:00:01.000Z',
        },
        now,
      )

      return <span>{expired ? 'Kedaluwarsa' : 'Aktif'}</span>
    }

    render(<StatusProbe />)
    expect(screen.getByText('Aktif')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(screen.getByText('Kedaluwarsa')).toBeInTheDocument()
  })
})
