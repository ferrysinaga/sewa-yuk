import { expect, test } from '@playwright/test'
import type { Locator, Page, TestInfo } from '@playwright/test'
import { eventId, login, missingEnv, organizer, skipMessage, tenantA } from './fixtures'

/**
 * QA-04: regresi responsif untuk peta, checkout, dan tabel admin.
 *
 * Tes publik selalu berjalan. Tes yang membutuhkan sesi atau data uji di-skip
 * dengan alasan variabel yang kurang, bukan dibiarkan gagal acak. Setiap tes
 * melampirkan screenshot ke laporan Playwright sebagai bukti visual.
 */

const VIEWPORTS = [
  { label: '375px', width: 375, height: 812 },
  { label: '768px', width: 768, height: 1024 },
  { label: '1280px', width: 1280, height: 900 },
] as const

async function expectNoPageOverflow(page: Page, label: string) {
  const metrics = await page.evaluate(() => {
    const root = document.documentElement

    return {
      rootScrollWidth: root.scrollWidth,
      rootClientWidth: root.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
    }
  })

  expect(
    metrics.rootScrollWidth,
    `${label}: dokumen tidak boleh memiliki horizontal scroll`,
  ).toBeLessThanOrEqual(metrics.rootClientWidth + 1)
  expect(
    metrics.bodyScrollWidth,
    `${label}: body tidak boleh lebih lebar dari viewport`,
  ).toBeLessThanOrEqual(metrics.rootClientWidth + 1)
}

async function expectInViewport(page: Page, locator: Locator, label: string) {
  await expect(locator, `${label}: kontrol harus terlihat`).toBeVisible()
  await locator.scrollIntoViewIfNeeded()

  const box = await locator.boundingBox()
  const viewport = page.viewportSize()

  expect(box, `${label}: bounding box tersedia`).not.toBeNull()
  expect(viewport, `${label}: viewport tersedia`).not.toBeNull()

  if (!box || !viewport) return

  expect(box.x, `${label}: tidak terpotong di kiri`).toBeGreaterThanOrEqual(-1)
  expect(box.x + box.width, `${label}: tidak terpotong di kanan`).toBeLessThanOrEqual(
    viewport.width + 1,
  )
  expect(box.y, `${label}: tidak terpotong di atas`).toBeGreaterThanOrEqual(-1)
}

async function expectTextFits(locator: Locator, label: string) {
  await expect(locator, `${label}: teks harus terlihat`).toBeVisible()

  const fits = await locator.evaluate((element) => {
    const style = getComputedStyle(element)

    // Elemen inline tidak punya clientWidth yang bermakna; biarkan browser
    // membungkus teks dan andalkan pemeriksaan overflow halaman.
    if (style.display === 'inline') return true

    return element.scrollWidth <= element.clientWidth + 1
  })

  expect(fits, `${label}: teks atau harga tidak boleh terpotong`).toBe(true)
}

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
  const body = await page.screenshot({ fullPage: true })

  await testInfo.attach(name, { body, contentType: 'image/png' })
}

for (const viewport of VIEWPORTS) {
  test.describe(`responsif ${viewport.label}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    test(`RESP-01: landing page muat tanpa overflow (${viewport.label})`, async ({
      page,
    }, testInfo) => {
      await page.goto('/')

      const heading = page.getByRole('heading', { level: 1 })
      await expect(heading).toContainText('Pilih posisinya.')
      await expectNoPageOverflow(page, `landing ${viewport.label}`)
      await expectInViewport(
        page,
        page.getByRole('link', { name: 'Jelajahi acara' }).first(),
        `landing ${viewport.label} CTA`,
      )
      await expectTextFits(heading, `landing ${viewport.label} heading`)

      await attachScreenshot(page, testInfo, `landing-${viewport.label}`)
    })

    test(`RESP-02: event explorer muat tanpa overflow (${viewport.label})`, async ({
      page,
    }, testInfo) => {
      await page.goto('/event')

      await expect(
        page.getByRole('heading', { level: 1, name: 'Temukan booth untuk bisnis Anda' }),
      ).toBeVisible()
      await expectNoPageOverflow(page, `event explorer ${viewport.label}`)
      await expectInViewport(
        page,
        page.getByLabel('Cari event berdasarkan nama, venue, atau deskripsi'),
        `event explorer ${viewport.label} pencarian`,
      )
      await expectInViewport(
        page,
        page.getByRole('button', { name: 'Semua' }),
        `event explorer ${viewport.label} filter kategori`,
      )

      await attachScreenshot(page, testInfo, `event-explorer-${viewport.label}`)
    })

    test(`RESP-03: peta dan panel detail event dapat dipakai (${viewport.label})`, async ({
      page,
    }, testInfo) => {
      const missing = missingEnv([['E2E_EVENT_ID', eventId]])
      test.skip(missing.length > 0, skipMessage('RESP-03', missing))

      await page.goto(`/event/${eventId}`)
      await expect(page.locator('[data-booth-id]').first()).toBeVisible({ timeout: 30_000 })
      await expectNoPageOverflow(page, `event detail ${viewport.label}`)

      const available = page.locator('[data-booth-id][data-booth-status="Available"]').first()
      const availableCount = await available.count()

      test.skip(availableCount === 0, 'RESP-03 dilewati: tidak ada booth Available pada event uji.')

      await available.click()

      const reserveButton = page.getByRole('button', {
        name: /Pesan booth ini|Booth tidak tersedia|Menunggu pembayaran/,
      })
      await expectInViewport(page, reserveButton, `event detail ${viewport.label} tombol booth`)

      const price = page.locator('#main').getByText(/^Rp/).first()
      if ((await price.count()) > 0) {
        await expectTextFits(price, `event detail ${viewport.label} harga`)
      }

      await attachScreenshot(page, testInfo, `event-detail-${viewport.label}`)
    })

    test(`RESP-04: modal checkout muat dan dapat ditutup (${viewport.label})`, async ({
      page,
    }, testInfo) => {
      const missing = missingEnv([
        ['E2E_EVENT_ID', eventId],
        ['E2E_TENANT_A_EMAIL', tenantA.email],
        ['E2E_TENANT_A_PASSWORD', tenantA.password],
      ])
      test.skip(missing.length > 0, skipMessage('RESP-04', missing))

      await login(page, tenantA)
      await page.goto(`/event/${eventId}`)
      await expect(page.locator('[data-booth-id]').first()).toBeVisible({ timeout: 30_000 })

      const available = page.locator('[data-booth-id][data-booth-status="Available"]').first()
      const availableCount = await available.count()

      test.skip(availableCount === 0, 'RESP-04 dilewati: tidak ada booth Available pada event uji.')

      await available.click()
      await page.getByRole('button', { name: 'Pesan booth ini' }).click()

      const dialog = page.getByRole('dialog', {
        name: /Konfirmasi pemesanan|Booth berhasil dikunci/,
      })
      await expect(dialog).toBeVisible()
      await expectNoPageOverflow(page, `checkout ${viewport.label}`)

      const dialogBox = await dialog.boundingBox()
      expect(dialogBox, 'checkout: dialog punya ukuran').not.toBeNull()

      if (dialogBox) {
        expect(dialogBox.x, 'checkout: dialog tidak keluar kiri').toBeGreaterThanOrEqual(-1)
        expect(
          dialogBox.x + dialogBox.width,
          'checkout: dialog tidak keluar kanan',
        ).toBeLessThanOrEqual(viewport.width + 1)
      }

      await expectInViewport(
        page,
        page.getByRole('button', { name: 'Batal' }),
        `checkout ${viewport.label} tombol batal`,
      )
      await expectInViewport(
        page,
        page.getByRole('button', { name: /Buat Pesanan & Kunci Booth|Pilih booth lain/ }),
        `checkout ${viewport.label} tombol utama`,
      )

      await attachScreenshot(page, testInfo, `checkout-${viewport.label}`)

      await page.keyboard.press('Escape')
      await expect(dialog).toBeHidden()
    })

    test(`RESP-05: tabel, filter, dan pagination admin dapat dijangkau (${viewport.label})`, async ({
      page,
    }, testInfo) => {
      const missing = missingEnv([
        ['E2E_ORGANIZER_EMAIL', organizer.email],
        ['E2E_ORGANIZER_PASSWORD', organizer.password],
      ])
      test.skip(missing.length > 0, skipMessage('RESP-05', missing))

      await login(page, organizer)
      await page.goto('/admin/bookings')
      await expect(page.getByRole('heading', { level: 1, name: 'Pemesanan Booth' })).toBeVisible()
      await expectNoPageOverflow(page, `admin bookings ${viewport.label}`)

      await expectInViewport(
        page,
        page.getByLabel('Cari pemesanan'),
        `admin bookings ${viewport.label} pencarian`,
      )
      await expectInViewport(
        page,
        page.getByLabel('Filter event'),
        `admin bookings ${viewport.label} filter event`,
      )
      await expectInViewport(
        page,
        page.getByLabel('Filter status'),
        `admin bookings ${viewport.label} filter status`,
      )

      const tableWrapper = page.locator('table').locator('..')
      await expect(tableWrapper).toHaveCSS('overflow-x', /auto|scroll/)

      const scrollable = await tableWrapper.evaluate((element) => ({
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      }))

      if (viewport.width < 1280) {
        expect(
          scrollable.scrollWidth,
          `admin bookings ${viewport.label}: tabel boleh scroll di dalam kontainer`,
        ).toBeGreaterThan(scrollable.clientWidth)
      }

      // Geser kontainer tabel ke kanan lalu pastikan kolom aksi tetap dapat
      // dijangkau tanpa membuat seluruh halaman ikut bergeser.
      await tableWrapper.evaluate((element) => {
        element.scrollLeft = element.scrollWidth
      })
      await expectInViewport(
        page,
        page.getByRole('columnheader', { name: 'Aksi' }),
        `admin bookings ${viewport.label} kolom aksi`,
      )
      await expectNoPageOverflow(page, `admin bookings ${viewport.label} setelah scroll`)

      await expectInViewport(
        page,
        page.getByRole('button', { name: 'Halaman berikutnya' }),
        `admin bookings ${viewport.label} pagination`,
      )

      const firstRow = page.locator('table tbody tr').first()
      if ((await firstRow.count()) > 0) {
        const priceCell = firstRow.locator('td').nth(4)
        if ((await priceCell.count()) > 0) {
          await expectTextFits(priceCell, `admin bookings ${viewport.label} harga`)
        }
      }

      await attachScreenshot(page, testInfo, `admin-bookings-${viewport.label}`)
    })
  })
}
