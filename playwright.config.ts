import { existsSync, readFileSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

/**
 * Muat variabel dari .env.e2e tanpa dependensi tambahan. File ini tidak
 * di-commit; salin .env.e2e.example lalu isi kredensial akun uji.
 * Variabel yang sudah ada di environment shell selalu menang.
 */
function loadEnvFile(path: string) {
  if (!existsSync(path)) return

  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match) continue

    const [, key, rawValue] = match
    if (process.env[key] !== undefined) continue

    process.env[key] = rawValue.replace(/^(['"])(.*)\1$/, '$2')
  }
}

loadEnvFile('.env.e2e')

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: {
    timeout: 20_000,
  },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // Panggil Vite lewat node agar tidak bergantung pada wrapper npm/npx.
        command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
