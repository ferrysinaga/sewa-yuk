import { useEffect, useState } from 'react'

/**
 * Menunda pembaruan nilai sampai `delay` milidetik berlalu tanpa perubahan.
 * Nilai input tetap responsif karena hanya nilai turunan yang ditunda.
 */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delay)

    return () => window.clearTimeout(timeoutId)
  }, [delay, value])

  return debouncedValue
}
