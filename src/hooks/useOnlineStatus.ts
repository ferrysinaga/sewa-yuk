import { useEffect, useState } from 'react'

/**
 * Status koneksi perangkat. Dipakai untuk memastikan UI tidak menampilkan
 * "Sinkron real-time" saat browser sedang offline, dan untuk memicu refetch
 * ketika koneksi pulih.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine)

    window.addEventListener('online', update)
    window.addEventListener('offline', update)

    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  return isOnline
}
