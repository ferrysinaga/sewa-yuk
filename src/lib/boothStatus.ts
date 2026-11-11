import type { BoothStatus } from '../types/booth'

interface StatusRow {
  id: string
  status: BoothStatus
}

/** Terapkan status optimistis pada daftar baris tanpa menyentuh baris lain. */
export function setRowStatus<T extends StatusRow>(rows: T[], id: string, status: BoothStatus): T[] {
  return rows.map((row) => (row.id === id ? { ...row, status } : row))
}

/**
 * Kembalikan status sebelumnya hanya bila baris masih berada pada status
 * optimistis. Jika Realtime sudah mengubahnya (misalnya booth diambil penyewa
 * lain), perubahan server tidak boleh ditimpa rollback klien.
 */
export function rollbackRowStatus<T extends StatusRow>(
  rows: T[],
  id: string,
  expectedStatus: BoothStatus,
  previousStatus: BoothStatus,
): T[] {
  return rows.map((row) =>
    row.id === id && row.status === expectedStatus ? { ...row, status: previousStatus } : row,
  )
}
