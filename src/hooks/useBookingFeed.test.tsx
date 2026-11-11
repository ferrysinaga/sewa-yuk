import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useBookingFeed } from './useBookingFeed'

const { subscribeCallbacks, removeChannel } = vi.hoisted(() => ({
  subscribeCallbacks: [] as ((status: string) => void)[],
  removeChannel: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    channel: vi.fn(() => {
      const channel = {
        on: vi.fn(() => channel),
        subscribe: vi.fn((callback: (status: string) => void) => {
          subscribeCallbacks.push(callback)
          return channel
        }),
      }

      return channel
    }),
    removeChannel,
  },
}))

const originalOnLine = navigator.onLine

function setOnLine(value: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => value,
  })
}

beforeEach(() => {
  subscribeCallbacks.length = 0
  removeChannel.mockClear()
  setOnLine(true)
})

afterEach(() => {
  setOnLine(originalOnLine)
})

describe('useBookingFeed', () => {
  it('meminta resync hanya setelah channel tersambung kembali', () => {
    const onResync = vi.fn()
    const setBookings = vi.fn()

    renderHook(() => useBookingFeed({ userId: 'tenant-1', setBookings, onResync }))

    expect(subscribeCallbacks).toHaveLength(1)

    act(() => subscribeCallbacks[0]('SUBSCRIBED'))
    expect(onResync).not.toHaveBeenCalled()

    act(() => subscribeCallbacks[0]('CHANNEL_ERROR'))
    act(() => subscribeCallbacks[0]('SUBSCRIBED'))

    expect(onResync).toHaveBeenCalledTimes(1)
  })

  it('meminta resync saat browser kembali online', () => {
    const onResync = vi.fn()
    const setBookings = vi.fn()

    renderHook(() => useBookingFeed({ userId: 'tenant-1', setBookings, onResync }))

    act(() => subscribeCallbacks[0]('SUBSCRIBED'))

    act(() => {
      setOnLine(false)
      window.dispatchEvent(new Event('offline'))
    })
    expect(onResync).not.toHaveBeenCalled()

    act(() => {
      setOnLine(true)
      window.dispatchEvent(new Event('online'))
    })

    expect(onResync).toHaveBeenCalledTimes(1)
  })

  it('menampilkan status terputus saat offline dan membersihkan channel', () => {
    const setBookings = vi.fn()

    const { result, unmount } = renderHook(() =>
      useBookingFeed({ userId: 'tenant-1', setBookings }),
    )

    act(() => subscribeCallbacks[0]('SUBSCRIBED'))
    expect(result.current.status).toBe('live')

    act(() => {
      setOnLine(false)
      window.dispatchEvent(new Event('offline'))
    })
    expect(result.current.status).toBe('disconnected')

    unmount()
    expect(removeChannel).toHaveBeenCalledTimes(1)
  })
})
