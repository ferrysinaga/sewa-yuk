/**
 * Ambil pesan dari Error, string, atau objek bergaya Supabase (`{ message }`).
 * Nilai yang tidak punya pesan memakai fallback agar teks mentah seperti
 * "null" atau "[object Object]" tidak pernah tampil ke pengguna.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message.trim() || fallback
  }

  if (typeof error === 'string') {
    return error.trim() || fallback
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = String((error as { message?: unknown }).message ?? '').trim()
    return message || fallback
  }

  return fallback
}

/** Pola kegagalan jaringan yang perlu dipetakan ke pesan ramah pengguna. */
export function isNetworkError(message: string): boolean {
  return /failed to fetch|network|timeout|load failed/i.test(message)
}
