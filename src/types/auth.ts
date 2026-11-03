export type UserRole = 'organizer' | 'tenant'

export const USER_ROLES: UserRole[] = ['organizer', 'tenant']

export function isUserRole(value: unknown): value is UserRole {
  return value === 'organizer' || value === 'tenant'
}
