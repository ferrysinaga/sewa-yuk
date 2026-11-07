import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Testing Library tidak mendaftarkan cleanup otomatis ketika `globals` mati,
// jadi bersihkan DOM secara eksplisit setelah setiap tes.
afterEach(() => {
  cleanup()
})
