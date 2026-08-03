import { describe, it, expect } from 'vitest'
import { davToDash, davToDashCompact, dashToDuffs, formatCompactCredits, creditsToDuffs, creditsFromInput, splitDashBalance } from '../../src/renderer/src/utils/balance'

const ONE_DASH = 100_000_000n

describe('creditsToDuffs', () => {
  it('converts at 1000 credits per duff', () => {
    expect(creditsToDuffs(1_000n)).toBe(1n)
    expect(creditsToDuffs(100_000_000_000n)).toBe(ONE_DASH)
    expect(creditsToDuffs(0n)).toBe(0n)
  })

  it('truncates sub-duff remainders toward zero', () => {
    expect(creditsToDuffs(999n)).toBe(0n)
    expect(creditsToDuffs(1_999n)).toBe(1n)
    expect(creditsToDuffs(-1_999n)).toBe(-1n)
  })
})

describe('creditsFromInput', () => {
  it('parses whole credit amounts', () => {
    expect(creditsFromInput('500000')).toBe(500_000n)
    expect(creditsFromInput('100000000000')).toBe(100_000_000_000n)
    expect(creditsFromInput('0')).toBe(0n)
    expect(creditsFromInput(' 42 ')).toBe(42n)
  })

  it('returns 0 for non-integer input', () => {
    expect(creditsFromInput('')).toBe(0n)
    expect(creditsFromInput('1.5')).toBe(0n)
    expect(creditsFromInput('abc')).toBe(0n)
    expect(creditsFromInput('-5')).toBe(0n)
    expect(creditsFromInput('1e6')).toBe(0n)
  })
})

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
  it('truncates to three fraction digits and trims zeros', () => {
    expect(davToDashCompact(ONE_DASH)).toBe('1')
    expect(davToDashCompact(150_000_000n)).toBe('1.5')
    expect(davToDashCompact(112_345_678n)).toBe('1.123')
    expect(davToDashCompact(100_100_000n)).toBe('1.001')
  })

  it('marks dust below the displayable precision', () => {
    expect(davToDashCompact(1n)).toBe('<0.001')
    expect(davToDashCompact(9_999n)).toBe('<0.001')
    expect(davToDashCompact(100_000n)).toBe('0.001')
    expect(davToDashCompact(0n)).toBe('0')
  })

  it('keeps the sign for negative amounts', () => {
    expect(davToDashCompact(-150_000_000n)).toBe('-1.5')
    expect(davToDashCompact(-1n)).toBe('-<0.001')
  })
})

describe('splitDashBalance', () => {
  it('splits at two decimals with the remainder in rest', () => {
    expect(splitDashBalance(123_456_789n)).toEqual({ main: '1.23', rest: '456789' })
    expect(splitDashBalance(512_300_000n)).toEqual({ main: '5.12', rest: '3' })
    expect(splitDashBalance(56_789n)).toEqual({ main: '0.00', rest: '056789' })
  })

  it('trims trailing zeros and drops empty parts', () => {
    expect(splitDashBalance(500_000_000n)).toEqual({ main: '5', rest: '' })
    expect(splitDashBalance(550_000_000n)).toEqual({ main: '5.5', rest: '' })
    expect(splitDashBalance(510_000_000n)).toEqual({ main: '5.1', rest: '' })
    expect(splitDashBalance(512_000_000n)).toEqual({ main: '5.12', rest: '' })
    expect(splitDashBalance(510_500_000n)).toEqual({ main: '5.10', rest: '5' })
  })

  it('handles zero, dust and negatives', () => {
    expect(splitDashBalance(0n)).toEqual({ main: '0', rest: '' })
    expect(splitDashBalance(1n)).toEqual({ main: '0.00', rest: '000001' })
    expect(splitDashBalance(-123_456_789n)).toEqual({ main: '-1.23', rest: '456789' })
    expect(splitDashBalance(-500_000_000n)).toEqual({ main: '-5', rest: '' })
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
