import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: './coverage',
      include: [
        'src/components/ui/**/*.tsx',
        'src/hooks/**/*.ts',
        'src/lib/**/*.ts',
        'src/store/**/*.ts',
      ],
      exclude: ['src/**/*.{test,spec}.{ts,tsx}'],
      // Ambang batas ditetapkan sedikit di bawah baseline saat CI pertama
      // dipasang (lines 42%, branches 43%, functions 66%, statements 46%)
      // agar perubahan kecil tidak langsung memerahkan pipeline. Naikkan
      // angka ini setiap kali cakupan bertambah.
      thresholds: {
        lines: 40,
        branches: 41,
        functions: 62,
        statements: 44,
      },
    },
  },
})
