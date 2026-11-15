import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

export interface Credentials {
  email: string
  password: string
}

function readCredentials(emailKey: string, passwordKey: string): Credentials {
  return {
    email: process.env[emailKey] ?? '',
    password: process.env[passwordKey] ?? '',
  }
}

export const organizer = readCredentials('E2E_ORGANIZER_EMAIL', 'E2E_ORGANIZER_PASSWORD')

export const tenantA = readCredentials('E2E_TENANT_A_EMAIL', 'E2E_TENANT_A_PASSWORD')
export const tenantB = readCredentials('E2E_TENANT_B_EMAIL', 'E2E_TENANT_B_PASSWORD')

export const eventId = process.env.E2E_EVENT_ID ?? ''
export const boothId = process.env.E2E_BOOTH_ID ?? ''

/**
 * Kredensial admin opsional untuk setup/teardown E2E. Service role melewati
 * RLS dan hanya boleh dipakai di staging/CI, tidak pernah di frontend.
 */
export const supabaseUrl = process.env.E2E_SUPABASE_URL ?? ''
export const anonKey = process.env.E2E_SUPABASE_ANON_KEY ?? ''
export const serviceRoleKey = process.env.E2E_SERVICE_ROLE_KEY ?? ''
export const hasAdminApi = Boolean(supabaseUrl && serviceRoleKey)
export const hasAnonApi = Boolean(supabaseUrl && anonKey)

/** ID data uji untuk suite negatif RLS. Semuanya opsional. */
export const draftEventId = process.env.E2E_DRAFT_EVENT_ID ?? ''
export const tenantABookingId = process.env.E2E_TENANT_A_BOOKING_ID ?? ''
export const tenantBBookingId = process.env.E2E_TENANT_B_BOOKING_ID ?? ''
export const unavailableBoothId = process.env.E2E_UNAVAILABLE_BOOTH_ID ?? ''
export const draftBoothId = process.env.E2E_DRAFT_BOOTH_ID ?? ''

/** Daftar nama variabel yang belum diisi, dipakai untuk alasan skip. */
export function missingEnv(entries: Array<[string, string]>): string[] {
  return entries.filter(([, value]) => !value).map(([key]) => key)
}

/** Alasan skip yang menyebut variabel .env.e2e yang kurang. */
export function skipMessage(label: string, missing: string[]): string {
  return `${label} dilewati. Isi ${missing.join(', ')} pada .env.e2e (lihat .env.e2e.example).`
}

/** Login lewat UI lalu tunggu redirect sesuai role. */
export async function login(page: Page, credentials: Credentials): Promise<void> {
  await page.goto('/login')
  await page.locator('#email').fill(credentials.email)
  await page.locator('#password').fill(credentials.password)
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await expect(page).toHaveURL(/\/(event|admin)(\/|$|\?)/, { timeout: 45_000 })
}

interface AdminRequestInit {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: string
}

/**
 * Panggil PostgREST dengan service role. Hanya untuk setup/teardown E2E;
 * jangan pernah memakai kunci ini di kode aplikasi.
 */
export async function adminRest<T>(path: string, init: AdminRequestInit = {}): Promise<T> {
  if (!hasAdminApi) {
    throw new Error('E2E_SUPABASE_URL dan E2E_SERVICE_ROLE_KEY belum diisi.')
  }

  const response = await fetch(`${supabaseUrl}/rest/v1${path}`, {
    method: init.method ?? 'GET',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: init.body,
  })

  if (!response.ok) {
    throw new Error(
      `Admin REST ${init.method ?? 'GET'} ${path} gagal: ${response.status} ${await response.text()}`,
    )
  }

  const text = await response.text()
  return (text ? JSON.parse(text) : null) as T
}

export interface RestResult {
  status: number
  body: unknown
  text: string
}

interface RestRequestInit {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  token?: string
  body?: unknown
  prefer?: string
}

/**
 * Panggil PostgREST dengan anon key (default) atau JWT pengguna. Dipakai suite
 * negatif RLS; tidak pernah memakai service role.
 */
export async function restRequest(path: string, init: RestRequestInit = {}): Promise<RestResult> {
  if (!hasAnonApi) {
    throw new Error('E2E_SUPABASE_URL dan E2E_SUPABASE_ANON_KEY belum diisi.')
  }

  const response = await fetch(`${supabaseUrl}/rest/v1${path}`, {
    method: init.method ?? 'GET',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${init.token ?? anonKey}`,
      'Content-Type': 'application/json',
      ...(init.prefer ? { Prefer: init.prefer } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })

  const text = await response.text()
  let body: unknown = null

  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }

  return { status: response.status, body, text }
}

/** Ambil access token lewat Auth REST memakai kredensial uji. */
export async function getAccessToken(credentials: Credentials): Promise<string> {
  if (!hasAnonApi) {
    throw new Error('E2E_SUPABASE_URL dan E2E_SUPABASE_ANON_KEY belum diisi.')
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: credentials.email,
      password: credentials.password,
    }),
  })

  if (!response.ok) {
    throw new Error(`Login REST gagal: ${response.status} ${await response.text()}`)
  }

  const data = (await response.json()) as { access_token?: string }

  if (!data.access_token) {
    throw new Error('Login REST tidak mengembalikan access_token.')
  }

  return data.access_token
}

/** True bila respons menunjukkan akses ditolak atau tidak ada baris berubah. */
export function isDeniedOrEmpty(result: RestResult): boolean {
  if (result.status === 401 || result.status === 403) return true
  if (result.status === 204) return true
  if (result.status >= 400) return true

  return Array.isArray(result.body) && result.body.length === 0
}

export interface AdminBookingRow {
  id: string
  status: string
  expires_at: string | null
}

/** Booking aktif untuk satu booth, diurutkan dari yang terbaru. */
export async function listActiveBookings(targetBoothId: string): Promise<AdminBookingRow[]> {
  const query = new URLSearchParams({
    booth_id: `eq.${targetBoothId}`,
    status: 'in.(pending,awaiting_confirmation,confirmed)',
    select: 'id,status,expires_at',
    order: 'created_at.desc',
  })

  return adminRest<AdminBookingRow[]>(`/bookings?${query.toString()}`)
}

/** Status booth saat ini, dibaca dengan service role. */
export async function getBoothStatus(targetBoothId: string): Promise<string | null> {
  const query = new URLSearchParams({
    id: `eq.${targetBoothId}`,
    select: 'status',
  })

  const rows = await adminRest<Array<{ status: string }>>(`/booths?${query.toString()}`)

  return rows[0]?.status ?? null
}

/** Majukan expires_at booking ke masa lalu agar sweep dapat diuji. */
export async function expireBooking(bookingId: string): Promise<void> {
  await adminRest(`/bookings?id=eq.${encodeURIComponent(bookingId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    }),
  })
}

/** Kembalikan booth uji ke kondisi awal: tanpa booking, status Available. */
export async function resetBooth(targetBoothId: string): Promise<void> {
  await adminRest(`/bookings?booth_id=eq.${encodeURIComponent(targetBoothId)}`, {
    method: 'DELETE',
  })

  await adminRest(`/booths?id=eq.${encodeURIComponent(targetBoothId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'Available',
      updated_at: new Date().toISOString(),
    }),
  })
}
