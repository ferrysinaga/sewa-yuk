import { expect, test } from '@playwright/test'
import type { Browser, BrowserContext, Page } from '@playwright/test'
import {
  boothId,
  eventId,
  expireBooking,
  getBoothStatus,
  hasAdminApi,
  listActiveBookings,
  login,
  missingEnv,
  resetBooth,
  serviceRoleKey,
  skipMessage,
  supabaseUrl,
  tenantA,
  tenantB,
} from './fixtures'

/**
 * E2E realtime SYNC-01/02/03/04.
 *
 * Tes ini membutuhkan dua akun tenant dan satu booth Available di Supabase
 * nyata karena inti skenarionya adalah sinkronisasi Realtime dan penanganan
 * race condition di database. Bila konfigurasi belum tersedia, seluruh tes
 * dilewati agar `npm run test:e2e` tetap hijau di mesin tanpa kredensial.
 *
 * `E2E_SUPABASE_URL` + `E2E_SERVICE_ROLE_KEY` bersifat opsional, tetapi
 * dibutuhkan untuk asersi database SYNC-03 dan seluruh setup SYNC-04. Kunci
 * service role hanya boleh dipakai di staging/CI, tidak pernah di produksi.
 */

const missing = missingEnv([
  ['E2E_TENANT_A_EMAIL', tenantA.email],
  ['E2E_TENANT_A_PASSWORD', tenantA.password],
  ['E2E_TENANT_B_EMAIL', tenantB.email],
  ['E2E_TENANT_B_PASSWORD', tenantB.password],
  ['E2E_EVENT_ID', eventId],
  ['E2E_BOOTH_ID', boothId],
])

test.skip(missing.length > 0, skipMessage('SYNC E2E', missing))

const adminMissing = missingEnv([
  ['E2E_SUPABASE_URL', supabaseUrl],
  ['E2E_SERVICE_ROLE_KEY', serviceRoleKey],
])

const boothSelector = `[data-booth-id="${boothId}"]`

async function openEvent(page: Page) {
  await page.goto(`/event/${eventId}`)
  await expect(page.locator(boothSelector)).toBeVisible({ timeout: 30_000 })
}

async function openTwoTenants(browser: Browser): Promise<{
  contextA: BrowserContext
  contextB: BrowserContext
  pageA: Page
  pageB: Page
}> {
  const contextA = await browser.newContext()
  const contextB = await browser.newContext()
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()

  await Promise.all([login(pageA, tenantA), login(pageB, tenantB)])

  await Promise.all([openEvent(pageA), openEvent(pageB)])

  return { contextA, contextB, pageA, pageB }
}

async function selectBoothAndOpenCheckout(page: Page) {
  await page.locator(boothSelector).click()
  await page.getByRole('button', { name: 'Pesan booth ini' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

async function confirmBooking(page: Page) {
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: /Buat Pesanan & Kunci Booth/ }).click()
  await expect(page.getByRole('heading', { name: 'Booth berhasil dikunci' })).toBeVisible({
    timeout: 45_000,
  })
}

async function reserveBooth(page: Page) {
  await selectBoothAndOpenCheckout(page)
  await confirmBooking(page)
}

/**
 * Kembalikan booth uji menjadi Available lewat UI agar tes berikutnya bisa
 * memakai booth yang sama. Best-effort: kegagalan cleanup tidak menutupi
 * hasil asersi utama.
 */
async function safeCancelBooking(page: Page) {
  try {
    await page.goto('/bookings')
    const cancelButton = page.getByRole('button', { name: 'Batalkan Pesanan' }).first()

    const visible = await cancelButton
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false)

    if (!visible) return

    await cancelButton.click()
    const confirm = page.getByRole('alertdialog')
    await expect(confirm).toBeVisible({ timeout: 10_000 })
    await confirm.getByRole('button', { name: /Ya, batalkan pesanan/ }).click()
    await expect(page.getByText(/Pesanan dibatalkan/)).toBeVisible({
      timeout: 20_000,
    })
  } catch {
    // Cleanup bersifat opsional; jangan gagalkan tes karena ini.
  }
}

/**
 * Service role menghapus seluruh booking booth uji lalu mengembalikan status
 * ke Available. Bila kunci admin tidak tersedia, fallback ke pembatalan UI.
 */
async function cleanup(
  contextA: BrowserContext,
  contextB: BrowserContext,
  pageA: Page,
  pageB: Page,
) {
  if (hasAdminApi) {
    try {
      await resetBooth(boothId)
    } catch (error) {
      console.warn('Gagal reset booth lewat admin API, mencoba pembatalan lewat UI.', error)
      await safeCancelBooking(pageA)
      await safeCancelBooking(pageB)
    }
  } else {
    await safeCancelBooking(pageA)
    await safeCancelBooking(pageB)
  }

  await contextA.close()
  await contextB.close()
}

test('SYNC-01: perubahan status booth terlihat real-time di konteks penyewa lain', async ({
  browser,
}) => {
  const { contextA, contextB, pageA, pageB } = await openTwoTenants(browser)

  try {
    await reserveBooth(pageA)

    const boothOnB = pageB.locator(boothSelector)

    // Tanpa reload: status booth di konteks B berubah menjadi Reserved.
    await expect(boothOnB).toHaveAttribute('data-booth-status', 'Reserved', {
      timeout: 30_000,
    })
    await expect(pageB.getByText(/booth sedang dipesan penyewa lain/)).toBeVisible()
  } finally {
    await cleanup(contextA, contextB, pageA, pageB)
  }
})

test('SYNC-02: booth yang dikunci penyewa lain tidak bisa dipesan', async ({ browser }) => {
  const { contextA, contextB, pageA, pageB } = await openTwoTenants(browser)

  try {
    await reserveBooth(pageA)

    const boothOnB = pageB.locator(boothSelector)
    await expect(boothOnB).toHaveAttribute('data-booth-status', 'Reserved', {
      timeout: 30_000,
    })

    // Booth tetap bisa diperiksa, tetapi aksi pemesanan nonaktif.
    await boothOnB.click()
    const reserveButton = pageB.getByRole('button', {
      name: 'Booth tidak tersedia',
    })

    await expect(reserveButton).toBeVisible()
    await expect(reserveButton).toBeDisabled()

    const sidebar = pageB.locator('aside')
    await expect(sidebar.getByText('Dipesan', { exact: true })).toBeVisible()
  } finally {
    await cleanup(contextA, contextB, pageA, pageB)
  }
})

test('SYNC-03: pemesanan bersamaan hanya menghasilkan satu transaksi', async ({ browser }) => {
  const { contextA, contextB, pageA, pageB } = await openTwoTenants(browser)

  try {
    // Keduanya memilih booth dan membuka checkout sebelum salah satu mengunci.
    await Promise.all([selectBoothAndOpenCheckout(pageA), selectBoothAndOpenCheckout(pageB)])

    const confirmA = pageA
      .getByRole('dialog')
      .getByRole('button', { name: /Buat Pesanan & Kunci Booth/ })
    const confirmB = pageB
      .getByRole('dialog')
      .getByRole('button', { name: /Buat Pesanan & Kunci Booth/ })

    // Tekan hampir bersamaan; database yang memutuskan pemenangnya.
    await Promise.all([confirmA.click(), confirmB.click()])

    const successA = pageA.getByRole('heading', {
      name: 'Booth berhasil dikunci',
    })
    const successB = pageB.getByRole('heading', {
      name: 'Booth berhasil dikunci',
    })

    await expect(successA.or(successB)).toBeVisible({ timeout: 45_000 })

    const aWon = await successA.isVisible()
    const bWon = await successB.isVisible()

    // Tepat satu konteks yang berhasil mengunci booth.
    expect(aWon !== bWon).toBe(true)

    const loser = aWon ? pageB : pageA
    await expect(loser.getByRole('alert')).toContainText(/Booth sudah tidak tersedia/)

    if (hasAdminApi) {
      // Bukti tingkat database: unique partial index BE-02 menyisakan tepat
      // satu booking aktif, bukan hanya satu pesan sukses di UI.
      await expect.poll(() => listActiveBookings(boothId), { timeout: 15_000 }).toHaveLength(1)
    } else {
      test.info().annotations.push({
        type: 'admin-api-skipped',
        description: `Asersi database SYNC-03 dilewati. Isi ${adminMissing.join(', ')} pada .env.e2e.`,
      })
    }
  } finally {
    await cleanup(contextA, contextB, pageA, pageB)
  }
})

test('SYNC-04: booking kedaluwarsa melepas booth kembali Available', async ({ browser }) => {
  test.skip(
    !hasAdminApi,
    skipMessage(
      'SYNC-04',
      missingEnv([
        ['E2E_SUPABASE_URL', supabaseUrl],
        ['E2E_SERVICE_ROLE_KEY', serviceRoleKey],
      ]),
    ),
  )

  const { contextA, contextB, pageA, pageB } = await openTwoTenants(browser)

  try {
    await reserveBooth(pageA)

    const active = await listActiveBookings(boothId)
    expect(active).toHaveLength(1)

    const booking = active[0]
    if (!booking) throw new Error('Booking aktif tidak ditemukan setelah reserveBooth.')

    await expireBooking(booking.id)

    // /bookings menjalankan sweep lebih dulu, lalu menampilkan alasan yang
    // jelas untuk booking yang dilepas.
    await pageA.goto('/bookings')
    await expect(pageA.getByText('Kedaluwarsa').first()).toBeVisible({ timeout: 30_000 })

    // Booth kembali Available di konteks tenant lain tanpa data uji tertahan.
    await openEvent(pageB)
    await expect(pageB.locator(boothSelector)).toHaveAttribute('data-booth-status', 'Available', {
      timeout: 30_000,
    })

    expect(await listActiveBookings(boothId)).toHaveLength(0)
    expect(await getBoothStatus(boothId)).toBe('Available')
  } finally {
    await cleanup(contextA, contextB, pageA, pageB)
  }
})
