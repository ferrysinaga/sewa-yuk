import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDebouncedValue } from './useDebouncedValue'

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('mengembalikan nilai awal secara langsung', () => {
    const { result } = renderHook(() => useDebouncedValue('awal'))

    expect(result.current).toBe('awal')
  })

  it('memperbarui nilai setelah 250 ms tanpa perubahan', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value),
      { initialProps: { value: 'awal' } },
    )

    rerender({ value: 'baru' })
    expect(result.current).toBe('awal')

    act(() => {
      vi.advanceTimersByTime(250)
    })

    expect(result.current).toBe('baru')
  })

  it('hanya memakai nilai terakhir saat mengetik cepat', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value),
      { initialProps: { value: '' } },
    )

    rerender({ value: 'b' })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    rerender({ value: 'bo' })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    rerender({ value: 'boo' })
    act(() => {
      vi.advanceTimersByTime(100)
    })

    expect(result.current).toBe('')

    act(() => {
      vi.advanceTimersByTime(250)
    })

    expect(result.current).toBe('boo')
  })
})
