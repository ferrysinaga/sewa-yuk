import type { User } from '@supabase/supabase-js'
import { isUserRole } from '../types/auth'
import type { UserRole } from '../types/auth'

export function getUserRole(user: User | null | undefined): UserRole | null {
  if (!user) return null

  const metadataRole = user.user_metadata?.role ?? user.app_metadata?.role
  return isUserRole(metadataRole) ? metadataRole : null
}

export function getDefaultRouteForRole(role: UserRole | null): string {
  return role === 'organizer' ? '/admin' : '/event'
}

export function validateEmail(value: string): string {
  if (!value.trim()) return 'Email wajib diisi.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'Format email tidak valid.'
  return ''
}

export function validatePassword(value: string): string {
  if (!value) return 'Kata sandi wajib diisi.'
  if (value.length < 8) return 'Kata sandi minimal 8 karakter.'
  return ''
}

export function getAuthErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)

  if (/invalid login credentials/i.test(message)) {
    return 'Email atau kata sandi salah.'
  }
  if (/email not confirmed/i.test(message)) {
    return 'Email belum dikonfirmasi. Periksa kotak masuk Anda.'
  }
  if (/user already registered/i.test(message)) {
    return 'Email sudah terdaftar. Silakan masuk.'
  }
  if (/password should be at least/i.test(message)) {
    return 'Kata sandi terlalu pendek. Gunakan minimal 8 karakter.'
  }
  if (/jwt|token/i.test(message)) {
    return 'Sesi gagal dibuat. Silakan coba lagi.'
  }
  if (/failed to fetch|network/i.test(message)) {
    return 'Tidak dapat terhubung ke server. Periksa koneksi Anda.'
  }

  return message || 'Terjadi kesalahan. Silakan coba lagi.'
}
