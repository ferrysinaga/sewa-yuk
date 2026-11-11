import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Pisahkan vendor besar agar cache antar-rilis lebih stabil dan
        // chunk utama tidak mendekati ambang peringatan 500 kB.
        // Vite 8 (rolldown) memakai codeSplitting groups; regex memakai
        // [\\/] agar cocok di Windows maupun POSIX.
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 40,
            },
            {
              name: 'react-router',
              test: /[\\/]node_modules[\\/](react-router|react-router-dom)[\\/]/,
              priority: 30,
            },
            {
              name: 'supabase',
              test: /[\\/]node_modules[\\/]@supabase[\\/]/,
              priority: 30,
            },
            {
              name: 'dnd',
              test: /[\\/]node_modules[\\/]@dnd-kit[\\/]/,
              priority: 30,
            },
          ],
        },
      },
    },
  },
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
      // Ambang batas ditetapkan sedikit di bawah baseline saat ini
      // (statements 76%, branches 69%, functions 86%, lines 76%) agar
      // perubahan kecil tidak langsung memerahkan pipeline. Naikkan angka
      // ini setiap kali cakupan bertambah.
      thresholds: {
        lines: 74,
        branches: 67,
        functions: 83,
        statements: 74,
      },
    },
  },
})
