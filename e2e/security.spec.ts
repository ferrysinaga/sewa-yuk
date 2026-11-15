import { expect, test } from '@playwright/test'
import {
  anonKey,
  boothId,
  draftBoothId,
  draftEventId,
  eventId,
  getAccessToken,
  isDeniedOrEmpty,
  login,
  missingEnv,
  organizer,
  restRequest,
  skipMessage,
  supabaseUrl,
  tenantA,
  tenantABookingId,
  tenantBBookingId,
  unavailableBoothId,
} from './fixtures'

/**
 * QA-03: suite negatif otorisasi dan RLS lewat REST + route guard.
 *
 * Tes ini membutuhkan staging karena memakai akun dan data uji nyata. Setiap
 * tes di-skip dengan alasan variabel yang kurang bila `.env.e2e` belum lengkap.
 * Tidak ada tes yang memakai service role; anon key dan JWT pengguna sudah
 * cukup untuk membuktikan penolakan.
 */

function skipUnless(label: string, entries: Array<[string, string]>) {
  const missing = missingEnv(entries)
  test.skip(missing.length > 0, skipMessage(label, missing))
}

const anonEnv: Array<[string, string]> = [
  ['E2E_SUPABASE_URL', supabaseUrl],
  ['E2E_SUPABASE_ANON_KEY', anonKey],
]

const tenantAEnv: Array<[string, string]> = [
  ...anonEnv,
  ['E2E_TENANT_A_EMAIL', tenantA.email],
  ['E2E_TENANT_A_PASSWORD', tenantA.password],
]

test('RLS-01: tenant tidak dapat membuka rute organizer', async ({ page }) => {
  skipUnless('RLS-01', [
    ['E2E_TENANT_A_EMAIL', tenantA.email],
    ['E2E_TENANT_A_PASSWORD', tenantA.password],
  ])

  await login(page, tenantA)
  await page.goto('/admin')

  await expect(page).toHaveURL(/\/event(\/|$|\?)/, { timeout: 30_000 })
  await expect(page.getByRole('heading', { name: /Dashboard|Pemesanan Booth/ })).toHaveCount(0)
})

test('RLS-02: tenant tidak dapat membaca blueprint draft', async () => {
  skipUnless('RLS-02', [...tenantAEnv, ['E2E_DRAFT_EVENT_ID', draftEventId]])

  const token = await getAccessToken(tenantA)
  const result = await restRequest(
    `/blueprints?id=eq.${encodeURIComponent(draftEventId)}&select=id`,
    { token },
  )

  expect(result.status).toBe(200)
  expect(result.body).toEqual([])
})

test('RLS-03: anon tidak dapat mengubah status booth', async () => {
  skipUnless('RLS-03', [...anonEnv, ['E2E_BOOTH_ID', boothId]])

  const path = `/booths?id=eq.${encodeURIComponent(boothId)}&select=status`
  const before = await restRequest(path)
  expect(before.status).toBe(200)
  expect(before.body).not.toEqual([])

  const update = await restRequest(`/booths?id=eq.${encodeURIComponent(boothId)}`, {
    method: 'PATCH',
    body: { status: 'Booked' },
    prefer: 'return=representation',
  })
  expect(isDeniedOrEmpty(update)).toBe(true)

  const after = await restRequest(path)
  expect(after.body).toEqual(before.body)
})

test('RLS-04: anon tidak dapat menyisipkan booth', async () => {
  const blueprintId = draftEventId || eventId

  skipUnless('RLS-04', [...anonEnv, ['E2E_DRAFT_EVENT_ID atau E2E_EVENT_ID', blueprintId]])

  const result = await restRequest('/booths', {
    method: 'POST',
    body: {
      blueprint_id: blueprintId,
      category: 'Tech',
      width: 10,
      height: 10,
      price: 1,
      status: 'Available',
    },
    prefer: 'return=representation',
  })

  expect(isDeniedOrEmpty(result)).toBe(true)
})

test('RLS-05: tenant tidak dapat membatalkan booking tenant lain', async () => {
  skipUnless('RLS-05', [...tenantAEnv, ['E2E_TENANT_B_BOOKING_ID', tenantBBookingId]])

  const token = await getAccessToken(tenantA)
  const result = await restRequest('/rpc/cancel_booking', {
    method: 'POST',
    token,
    body: { p_booking_id: tenantBBookingId },
  })

  expect(result.status).toBeGreaterThanOrEqual(400)
  expect(result.body).toMatchObject({ hint: 'SWY_NOT_OWNER' })
})

test('RLS-06: anon tidak dapat membaca bookings', async () => {
  skipUnless('RLS-06', anonEnv)

  const result = await restRequest('/bookings?select=id')
  expect(isDeniedOrEmpty(result)).toBe(true)
})

test('RLS-07: tenant tidak dapat menulis booth langsung', async () => {
  skipUnless('RLS-07', [
    ...tenantAEnv,
    ['E2E_BOOTH_ID', boothId],
    ['E2E_DRAFT_EVENT_ID', draftEventId],
  ])

  const token = await getAccessToken(tenantA)
  const path = `/booths?id=eq.${encodeURIComponent(boothId)}&select=status`
  const before = await restRequest(path)
  expect(before.status).toBe(200)

  const update = await restRequest(`/booths?id=eq.${encodeURIComponent(boothId)}`, {
    method: 'PATCH',
    token,
    body: { status: 'Booked' },
    prefer: 'return=representation',
  })
  expect(isDeniedOrEmpty(update)).toBe(true)

  const insert = await restRequest('/booths', {
    method: 'POST',
    token,
    body: {
      blueprint_id: draftEventId,
      category: 'Tech',
      width: 10,
      height: 10,
      price: 1,
      status: 'Available',
    },
    prefer: 'return=representation',
  })
  expect(isDeniedOrEmpty(insert)).toBe(true)

  const after = await restRequest(path)
  expect(after.body).toEqual(before.body)
})

test('RLS-08: tenant tidak dapat menulis blueprint', async () => {
  skipUnless('RLS-08', [...tenantAEnv, ['E2E_DRAFT_EVENT_ID', draftEventId]])

  const token = await getAccessToken(tenantA)
  const update = await restRequest(`/blueprints?id=eq.${encodeURIComponent(draftEventId)}`, {
    method: 'PATCH',
    token,
    body: { name: 'RLS negative test' },
    prefer: 'return=representation',
  })
  expect(isDeniedOrEmpty(update)).toBe(true)

  const insert = await restRequest('/blueprints', {
    method: 'POST',
    token,
    body: { id: 'rls-negative-test', name: 'RLS negative test', status: 'draft' },
    prefer: 'return=representation',
  })
  expect(isDeniedOrEmpty(insert)).toBe(true)
})

test('RLS-09: tenant A tidak dapat membaca booking tenant B', async () => {
  skipUnless('RLS-09', [...tenantAEnv, ['E2E_TENANT_B_BOOKING_ID', tenantBBookingId]])

  const token = await getAccessToken(tenantA)
  const result = await restRequest(
    `/bookings?id=eq.${encodeURIComponent(tenantBBookingId)}&select=id`,
    { token },
  )

  expect(result.status).toBe(200)
  expect(result.body).toEqual([])
})

test('RLS-10: tenant tidak dapat memanggil RPC organizer', async () => {
  skipUnless('RLS-10', [...tenantAEnv, ['E2E_TENANT_A_BOOKING_ID', tenantABookingId]])

  const token = await getAccessToken(tenantA)
  const result = await restRequest('/rpc/confirm_booking', {
    method: 'POST',
    token,
    body: { p_booking_id: tenantABookingId },
  })

  expect(result.status).toBeGreaterThanOrEqual(400)
  expect(result.body).toMatchObject({ hint: 'SWY_FORBIDDEN' })
})

test('RLS-11: anon tidak dapat memanggil RPC tulis', async () => {
  skipUnless('RLS-11', [...anonEnv, ['E2E_BOOTH_ID', boothId]])

  const bookingId = '00000000-0000-4000-8000-000000000000'
  const calls: Array<[string, unknown]> = [
    ['create_booking', { p_booth_id: boothId, p_payment_method: 'va' }],
    ['mark_booking_paid', { p_booking_id: bookingId }],
    ['cancel_booking', { p_booking_id: bookingId }],
    ['confirm_booking', { p_booking_id: bookingId }],
  ]

  for (const [rpc, body] of calls) {
    const result = await restRequest(`/rpc/${rpc}`, { method: 'POST', body })

    expect(result.status, `${rpc} harus ditolak`).toBeGreaterThanOrEqual(400)
    expect(result.text, `${rpc} harus ditolak grant`).toMatch(/permission denied|42501/i)
  }
})

test('RLS-17: tenant tidak dapat memesan booth Reserved/Booked', async () => {
  skipUnless('RLS-17', [...tenantAEnv, ['E2E_UNAVAILABLE_BOOTH_ID', unavailableBoothId]])

  const token = await getAccessToken(tenantA)
  const result = await restRequest('/rpc/create_booking', {
    method: 'POST',
    token,
    body: { p_booth_id: unavailableBoothId, p_payment_method: 'va' },
  })

  expect(result.status).toBeGreaterThanOrEqual(400)
  expect(result.body).toMatchObject({ hint: 'SWY_BOOTH_UNAVAILABLE' })
})

test('RLS-18: tenant tidak dapat memesan booth pada blueprint draft', async () => {
  skipUnless('RLS-18', [...tenantAEnv, ['E2E_DRAFT_BOOTH_ID', draftBoothId]])

  const token = await getAccessToken(tenantA)
  const result = await restRequest('/rpc/create_booking', {
    method: 'POST',
    token,
    body: { p_booth_id: draftBoothId, p_payment_method: 'va' },
  })

  expect(result.status).toBeGreaterThanOrEqual(400)
  expect(result.body).toMatchObject({ hint: 'SWY_EVENT_NOT_PUBLISHED' })
})

test('RLS-15: organizer tidak dapat menulis booking langsung', async () => {
  skipUnless('RLS-15', [
    ...anonEnv,
    ['E2E_ORGANIZER_EMAIL', organizer.email],
    ['E2E_ORGANIZER_PASSWORD', organizer.password],
    ['E2E_TENANT_A_BOOKING_ID', tenantABookingId],
  ])

  const token = await getAccessToken(organizer)
  const result = await restRequest(`/bookings?id=eq.${encodeURIComponent(tenantABookingId)}`, {
    method: 'PATCH',
    token,
    body: { status: 'pending' },
    prefer: 'return=representation',
  })

  expect(isDeniedOrEmpty(result)).toBe(true)
})
