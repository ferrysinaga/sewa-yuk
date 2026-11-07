import { describe, expect, it } from 'vitest'
import { resolveRealtimeStatus } from './realtimeStatus'

describe('resolveRealtimeStatus', () => {
  it('menandai SUBSCRIBED sebagai live', () => {
    expect(resolveRealtimeStatus('SUBSCRIBED')).toBe('live')
  })

  it('menandai gangguan channel sebagai terputus', () => {
    expect(resolveRealtimeStatus('CHANNEL_ERROR')).toBe('disconnected')
    expect(resolveRealtimeStatus('TIMED_OUT')).toBe('disconnected')
    expect(resolveRealtimeStatus('CLOSED')).toBe('disconnected')
  })

  it('mempertahankan status lain sebagai menghubungkan', () => {
    expect(resolveRealtimeStatus('UNKNOWN')).toBe('connecting')
    expect(resolveRealtimeStatus('')).toBe('connecting')
  })
})
