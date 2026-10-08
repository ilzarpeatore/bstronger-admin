import { describe, it, expect } from 'vitest'
import { share, timeAgo } from '@/lib/appMonitoring'

describe('timeAgo', () => {
  const now = new Date('2026-10-07T12:00:00Z')
  it('formats minutes, hours and days', () => {
    expect(timeAgo('2026-10-07T11:59:30Z', now)).toBe('ahora')
    expect(timeAgo('2026-10-07T11:55:00Z', now)).toBe('hace 5 min')
    expect(timeAgo('2026-10-07T09:00:00Z', now)).toBe('hace 3 h')
    expect(timeAgo('2026-10-05T12:00:00Z', now)).toBe('hace 2 d')
  })
  it('handles missing dates', () => {
    expect(timeAgo(null, now)).toBe('—')
  })
})

describe('share', () => {
  it('returns a one-decimal percentage and 0 without total', () => {
    expect(share(1, 3)).toBe(33.3)
    expect(share(5, 0)).toBe(0)
  })
})
