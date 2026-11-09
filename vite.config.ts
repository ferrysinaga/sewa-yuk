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
