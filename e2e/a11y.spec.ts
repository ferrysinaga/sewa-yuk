import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { AxeResults } from 'axe-core'

/**
 * Audit aksesibilitas WCAG A/AA dengan axe-core.
 *
 * Halaman publik selalu dijalankan. Halaman yang membutuhkan sesi hanya
 * dijalankan bila kredensial uji tersedia di .env.e2e (lihat
 * .env.e2e.example). Tes yang dilewati akan menampilkan alasan yang jelas.
 */

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

const organizer = {
  email: process.env.E2E_ORGANIZER_EMAIL ?? '',
  password: process.env.E2E_ORGANIZER_PASSWORD ?? '',
}

const tenant = {
  email: process.env.E2E_TENANT_A_EMAIL ?? '',
  password: process.env.E2E_TENANT_A_PASSWORD ?? '',
}

const eventId = process.env.E2E_EVENT_ID ?? ''

function formatViolations(violations: AxeResults['violations']): string {
  return violations
    .map((violation) => {
      const targets = violation.nodes
        .map((node) => `    - ${node.target.join(' ')}`)
        .join('\n')

      return `${violation.id} (${violation.impact ?? 'unknown'}): ${violation.help}\n${targets}`
    })
    .join('\n\n')
}

async function expectNoViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()

  expect(
    results.violations,
    `${label} memiliki pelanggaran aksesibilitas:\n${formatViolations(results.violations)}`,
  ).toEqual([])
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await page.waitForURL(/\/(event|admin)(\/|$|\?)/, { timeout: 45_000 })
}

async function waitForPage(page: Page, heading?: string) {
  await expect(page.getByRole('heading', { level: 1, name: heading }).first()).toBeVisible({
    timeout: 30_000,
  })
}

test('A11Y-01: Landing page tidak memiliki pelanggaran WCAG AA', async ({ page }) => {
  await page.goto('/')
  await waitForPage(page)
  await expectNoViolations(page, 'Landing page')
})

test('A11Y-02: Event explorer tidak memiliki pelanggaran WCAG AA', async ({ page }) => {
  await page.goto('/event')
  await waitForPage(page, 'Temukan booth untuk bisnis Anda')
  await expectNoViolations(page, 'Event explorer')
})

test('A11Y-03: Detail event tidak memiliki pelanggaran WCAG AA', async ({ page }) => {
  test.skip(
    !eventId,
    'Dilewati: isi E2E_EVENT_ID pada .env.e2e untuk mengaudit /event/:id.',
  )

  await page.goto(`/event/${eventId}`)
  await waitForPage(page)
  await expectNoViolations(page, 'Detail event')
})

test('A11Y-04: Dashboard organizer tidak memiliki pelanggaran WCAG AA', async ({
  page,
}) => {
  test.skip(
    !organizer.email || !organizer.password,
    'Dilewati: isi E2E_ORGANIZER_EMAIL dan E2E_ORGANIZER_PASSWORD pada .env.e2e.',
  )

  await login(page, organizer.email, organizer.password)
  await page.goto('/admin')
  await waitForPage(page)
  await expectNoViolations(page, 'Dashboard organizer')
})

test('A11Y-05: Pemesanan organizer tidak memiliki pelanggaran WCAG AA', async ({
  page,
}) => {
  test.skip(
    !organizer.email || !organizer.password,
    'Dilewati: isi E2E_ORGANIZER_EMAIL dan E2E_ORGANIZER_PASSWORD pada .env.e2e.',
  )

  await login(page, organizer.email, organizer.password)
  await page.goto('/admin/bookings')
  await waitForPage(page, 'Pemesanan Booth')
  await expectNoViolations(page, 'Pemesanan organizer')
})

test('A11Y-06: Pesanan tenant tidak memiliki pelanggaran WCAG AA', async ({ page }) => {
  test.skip(
    !tenant.email || !tenant.password,
    'Dilewati: isi E2E_TENANT_A_EMAIL dan E2E_TENANT_A_PASSWORD pada .env.e2e.',
  )

  await login(page, tenant.email, tenant.password)
  await page.goto('/bookings')
  await waitForPage(page, 'Pesanan Saya')
  await expect(page).toHaveURL(/\/bookings(\/|$|\?)/)
  await expectNoViolations(page, 'Pesanan tenant')
})
