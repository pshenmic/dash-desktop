import { describe, expect, it } from 'vitest'
import { formatAgo, formatTimeLeft } from '../../src/renderer/src/utils/timeLeft'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const NOW = 1_800_000_000_000

describe('formatTimeLeft', () => {
  it('shows days and hours, hours and minutes, or minutes', () => {
    expect(formatTimeLeft(NOW + 3 * DAY + 14 * HOUR + 5 * MINUTE, NOW)).toBe('3d 14h')
    expect(formatTimeLeft(NOW + 5 * DAY + 2 * HOUR, NOW)).toBe('5d 02h')
    expect(formatTimeLeft(NOW + 18 * HOUR + 42 * MINUTE, NOW)).toBe('18h 42m')
    expect(formatTimeLeft(NOW + HOUR + 5 * MINUTE, NOW)).toBe('1h 05m')
    expect(formatTimeLeft(NOW + 12 * MINUTE + 30_000, NOW)).toBe('12m')
  })

  it('collapses the last minute and the end', () => {
    expect(formatTimeLeft(NOW + 30_000, NOW)).toBe('<1m')
    expect(formatTimeLeft(NOW, NOW)).toBe('Ended')
    expect(formatTimeLeft(NOW - DAY, NOW)).toBe('Ended')
  })
})

describe('formatAgo', () => {
  it('rounds down to the largest whole unit', () => {
    expect(formatAgo(NOW - 30_000, NOW)).toBe('just now')
    expect(formatAgo(NOW + MINUTE, NOW)).toBe('just now')
    expect(formatAgo(NOW - 5 * MINUTE, NOW)).toBe('5m ago')
    expect(formatAgo(NOW - 2 * HOUR - 59 * MINUTE, NOW)).toBe('2h ago')
    expect(formatAgo(NOW - 3 * DAY, NOW)).toBe('3d ago')
    expect(formatAgo(NOW - 75 * DAY, NOW)).toBe('2mo ago')
    expect(formatAgo(NOW - 400 * DAY, NOW)).toBe('1y ago')
  })
})
