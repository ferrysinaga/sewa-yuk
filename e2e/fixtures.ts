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
