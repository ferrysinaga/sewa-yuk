import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useBookingFeed } from './useBookingFeed'

interface SubscriptionConfig {
  event: string
  schema: string
  table: string
  filter?: string
}

const { subscribeCallbacks, removeChannel, onCalls, channelNames } = vi.hoisted(() => ({
  subscribeCallbacks: [] as ((status: string) => void)[],
  removeChannel: vi.fn(),
  onCalls: [] as { event: string; config: SubscriptionConfig }[],
  channelNames: [] as string[],
}))

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    channel: vi.fn((name: string) => {
      channelNames.push(name)
      const channel = {
        on: vi.fn((event: string, config: SubscriptionConfig) => {
          onCalls.push({ event, config })
          return channel
        }),
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
  onCalls.length = 0
  channelNames.length = 0
  removeChannel.mockClear()
  setOnLine(true)
})

afterEach(() => {
  setOnLine(originalOnLine)
})

describe('useBookingFeed', () => {
  it('membatasi feed tenant ke booking miliknya lewat filter user_id', () => {
    const setBookings = vi.fn()

    renderHook(() => useBookingFeed({ userId: 'tenant-1', setBookings }))

    expect(onCalls).toHaveLength(1)
    expect(onCalls[0].event).toBe('postgres_changes')
    expect(onCalls[0].config).toEqual({
      event: '*',
      schema: 'public',
      table: 'bookings',
      filter: 'user_id=eq.tenant-1',
    })
    expect(channelNames[0]).toContain('tenant-bookings-tenant-1')
  })

  it('tidak memakai filter untuk feed organizer', () => {
    const setBookings = vi.fn()

    renderHook(() => useBookingFeed({ userId: null, setBookings }))

    expect(onCalls).toHaveLength(1)
    expect(onCalls[0].config).toEqual({
      event: '*',
      schema: 'public',
      table: 'bookings',
    })
    expect(channelNames[0]).toContain('admin-bookings')
  })

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
