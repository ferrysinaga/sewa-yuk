import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'dist',
      'coverage',
      'node_modules',
      'playwright-report',
      'test-results',
      '*.config.js',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommended],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // Dua aturan inti React Hooks. Aturan compiler baru (mis.
      // set-state-in-effect) sengaja tidak diaktifkan karena pola fetch di
      // halaman ini sudah berjalan dan akan ditinjau pada sprint terpisah.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Halaman ini hanya mengekspor komponen; aturan ini tidak menambah nilai
      // dan sering memberi false positive pada file berisi helper.
      'react-refresh/only-export-components': 'off',
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  prettier,
)
