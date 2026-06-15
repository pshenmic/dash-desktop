import { describe, it, expect } from 'vitest'
import { davToDash, davToDashCompact, dashToDuffs, formatCompactCredits } from '../../src/renderer/src/utils/balance'

const ONE_DASH = 100_000_000n

describe('davToDash', () => {
  it('formats whole and fractional amounts', () => {
    expect(davToDash(ONE_DASH)).toBe('1')
    expect(davToDash(ONE_DASH / 2n)).toBe('0.5')
    expect(davToDash(0n)).toBe('0')
    expect(davToDash(150_000_000n)).toBe('1.5')
  })

  it('trims trailing zeros and handles negatives', () => {
    expect(davToDash(1n)).toBe('0.00000001')
    expect(davToDash(-ONE_DASH)).toBe('-1')
  })
})

describe('dashToDuffs', () => {
  it('parses whole and fractional DASH into duffs', () => {
    expect(dashToDuffs('1')).toBe(ONE_DASH)
    expect(dashToDuffs('1.5')).toBe(150_000_000n)
    expect(dashToDuffs('0.00000001')).toBe(1n)
    expect(dashToDuffs('0')).toBe(0n)
  })

  it('handles partial input gracefully', () => {
    expect(dashToDuffs('')).toBe(0n)
    expect(dashToDuffs('.')).toBe(0n)
    expect(dashToDuffs('.5')).toBe(50_000_000n)
    expect(dashToDuffs('2.')).toBe(2n * ONE_DASH)
  })

  it('truncates fractional digits beyond 8', () => {
    expect(dashToDuffs('1.123456789')).toBe(112_345_678n)
  })

  it('returns 0 for non-numeric input', () => {
    expect(dashToDuffs('abc')).toBe(0n)
    expect(dashToDuffs('1.2.3')).toBe(0n)
  })

  it('round-trips with davToDash for representable values', () => {
    for (const v of [ONE_DASH, 150_000_000n, 1n, 0n, 123_456_789n]) {
      expect(dashToDuffs(davToDash(v))).toBe(v)
    }
  })
})

describe('davToDashCompact', () => {
  it('truncates to four fraction digits and trims zeros', () => {
    expect(davToDashCompact(ONE_DASH)).toBe('1')
    expect(davToDashCompact(150_000_000n)).toBe('1.5')
    expect(davToDashCompact(112_345_678n)).toBe('1.1234')
    expect(davToDashCompact(100_100_000n)).toBe('1.001')
  })

  it('marks dust below the displayable precision', () => {
    expect(davToDashCompact(1n)).toBe('<0.0001')
    expect(davToDashCompact(9_999n)).toBe('<0.0001')
    expect(davToDashCompact(10_000n)).toBe('0.0001')
    expect(davToDashCompact(0n)).toBe('0')
  })

  it('keeps the sign for negative amounts', () => {
    expect(davToDashCompact(-150_000_000n)).toBe('-1.5')
    expect(davToDashCompact(-1n)).toBe('-<0.0001')
  })
})

describe('formatCompactCredits', () => {
  it('compacts large credit amounts', () => {
    expect(formatCompactCredits(2_500_000n)).toBe('2.5M')
    expect(formatCompactCredits(1_000_000_000n)).toBe('1B')
    expect(formatCompactCredits(3_000_000_000_000n)).toBe('3T')
  })

  it('leaves small amounts intact', () => {
    expect(formatCompactCredits(500n)).toBe('500')
    expect(formatCompactCredits(0n)).toBe('0')
  })
})
