import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--color-canvas)',
        surface: 'var(--color-surface)',
        map: 'var(--color-map)',
        ink: 'var(--color-ink)',
        muted: 'var(--color-muted)',
        line: 'var(--color-line)',
        pine: {
          DEFAULT: 'var(--color-pine)',
          dark: 'var(--color-pine-dark)',
          soft: 'var(--color-pine-soft)',
        },
        clay: {
          DEFAULT: 'var(--color-clay)',
          dark: 'var(--color-clay-dark)',
          soft: 'var(--color-clay-soft)',
        },
        unavailable: {
          DEFAULT: 'var(--color-unavailable)',
          deep: 'var(--color-unavailable-deep)',
        },
        danger: {
          DEFAULT: 'var(--color-danger)',
          dark: 'var(--color-danger-dark)',
          soft: 'var(--color-danger-soft)',
        },
        overlay: 'var(--color-overlay)',
      },
    },
  },
  plugins: [],
} satisfies Config
