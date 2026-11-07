export type RealtimeStatus = 'connecting' | 'live' | 'disconnected'

/**
 * Petakan status channel Supabase Realtime ke tiga keadaan yang dipakai UI.
 * Status yang belum dikenal tetap dianggap sedang menghubungkan.
 */
export function resolveRealtimeStatus(channelStatus: string): RealtimeStatus {
  if (channelStatus === 'SUBSCRIBED') return 'live'

  if (
    channelStatus === 'CHANNEL_ERROR' ||
    channelStatus === 'TIMED_OUT' ||
    channelStatus === 'CLOSED'
  ) {
    return 'disconnected'
  }

  return 'connecting'
}
