import { describe, expect, it } from 'vitest'
import type { User } from '@supabase/supabase-js'
import { getDefaultRouteForRole, getUserRole } from './auth'

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'user@example.com',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as User
}

describe('getUserRole', () => {
  it('membaca role organizer dari app_metadata', () => {
    const user = makeUser({ app_metadata: { role: 'organizer' } })

    expect(getUserRole(user)).toBe('organizer')
    expect(getDefaultRouteForRole('organizer')).toBe('/admin')
  })

  it('membaca role tenant dari app_metadata', () => {
    const user = makeUser({ app_metadata: { role: 'tenant' } })

    expect(getUserRole(user)).toBe('tenant')
    expect(getDefaultRouteForRole('tenant')).toBe('/event')
  })

  it('menganggap akun tanpa app_metadata.role sebagai tenant', () => {
    expect(getUserRole(makeUser())).toBe('tenant')
    expect(getUserRole(makeUser({ app_metadata: { role: 'admin' } }))).toBe('tenant')
  })

  it('mengabaikan user_metadata.role yang dapat diubah sendiri (F1)', () => {
    const user = makeUser({
      app_metadata: {},
      user_metadata: { role: 'organizer' },
    })

    expect(getUserRole(user)).toBe('tenant')
  })

  it('app_metadata.role tetap menang saat user_metadata berbeda', () => {
    const user = makeUser({
      app_metadata: { role: 'tenant' },
      user_metadata: { role: 'organizer' },
    })

    expect(getUserRole(user)).toBe('tenant')
  })

  it('mengembalikan null tanpa user', () => {
    expect(getUserRole(null)).toBeNull()
    expect(getUserRole(undefined)).toBeNull()
  })
})
