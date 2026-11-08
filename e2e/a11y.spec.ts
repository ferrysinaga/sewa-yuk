import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { AxeResults } from 'axe-core'
import {
  eventId,
  login,
  missingEnv,
  organizer,
  skipMessage,
  tenantA,
} from './fixtures'

/**
 * Audit aksesibilitas WCAG A/AA dengan axe-core.
 *
 * Halaman publik selalu dijalankan. Halaman yang membutuhkan sesi hanya
 * dijalankan bila kredensial uji tersedia di .env.e2e (lihat
 * .env.e2e.example). Tes yang dilewati akan menampilkan alasan yang jelas.
 */

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

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
    skipMessage('A11Y-03', missingEnv([['E2E_EVENT_ID', eventId]])),
  )

  await page.goto(`/event/${eventId}`)
  await waitForPage(page)
  await expectNoViolations(page, 'Detail event')
})

test('A11Y-04: Dashboard organizer tidak memiliki pelanggaran WCAG AA', async ({
  page,
}) => {
  const missing = missingEnv([
    ['E2E_ORGANIZER_EMAIL', organizer.email],
    ['E2E_ORGANIZER_PASSWORD', organizer.password],
  ])
  test.skip(missing.length > 0, skipMessage('A11Y-04', missing))

  await login(page, organizer)
  await page.goto('/admin')
  await waitForPage(page)
  await expectNoViolations(page, 'Dashboard organizer')
})

test('A11Y-05: Pemesanan organizer tidak memiliki pelanggaran WCAG AA', async ({
  page,
}) => {
  const missing = missingEnv([
    ['E2E_ORGANIZER_EMAIL', organizer.email],
    ['E2E_ORGANIZER_PASSWORD', organizer.password],
  ])
  test.skip(missing.length > 0, skipMessage('A11Y-05', missing))

  await login(page, organizer)
  await page.goto('/admin/bookings')
  await waitForPage(page, 'Pemesanan Booth')
  await expectNoViolations(page, 'Pemesanan organizer')
})

test('A11Y-06: Pesanan tenant tidak memiliki pelanggaran WCAG AA', async ({ page }) => {
  const missing = missingEnv([
    ['E2E_TENANT_A_EMAIL', tenantA.email],
    ['E2E_TENANT_A_PASSWORD', tenantA.password],
  ])
  test.skip(missing.length > 0, skipMessage('A11Y-06', missing))

  await login(page, tenantA)
  await page.goto('/bookings')
  await waitForPage(page, 'Pesanan Saya')
  await expect(page).toHaveURL(/\/bookings(\/|$|\?)/)
  await expectNoViolations(page, 'Pesanan tenant')
})
