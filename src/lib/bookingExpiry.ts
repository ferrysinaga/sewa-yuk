import { isSupabaseConfigured, supabase } from './supabase'

/**
 * Melepas booking pending yang sudah melewati expires_at.
 *
 * Dipanggil saat halaman pemesanan/event dibuka dan dari tombol "Perbarui
 * status". Pemanggilan bersifat best-effort: kegagalan tidak boleh membuat
 * halaman gagal memuat data. Pengaman utama tetap pg_cron di server.
 *
 * @returns jumlah booking yang dilepas, atau null bila RPC gagal dipanggil.
 */
export async function sweepExpiredBookings(): Promise<number | null> {
  if (!isSupabaseConfigured) return null

  try {
    const { data, error } = await supabase.rpc('release_expired_bookings')

    if (error) {
      console.warn('Gagal melepas booking kedaluwarsa:', error.message)
      return null
    }

    const released = typeof data === 'number' ? data : Number(data ?? 0)

    return Number.isFinite(released) ? released : 0
  } catch (error) {
    console.warn('Gagal memanggil release_expired_bookings:', error)
    return null
  }
}
