import { expect, test } from '@playwright/test'

/**
 * Smoke test tanpa kredensial: memastikan dev server, browser, dan routing
 * dasar berjalan. Skenario realtime SYNC-01/02/03 ada di sync.spec.ts dan
 * hanya berjalan bila .env.e2e terisi.
 */
test('halaman login dapat dimuat', async ({ page }) => {
  await page.goto('/login')

  await expect(
    page.getByRole('heading', { name: 'Masuk ke akun Anda' }),
  ).toBeVisible()
  await expect(page.locator('#email')).toBeVisible()
  await expect(page.locator('#password')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Masuk', exact: true }),
  ).toBeEnabled()
})
