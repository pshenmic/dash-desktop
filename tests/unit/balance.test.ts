import { describe, it, expect } from 'vitest'
import { compareBigIntsDescending, creditsToDash, creditsToDuffs, davToDash, davToDashCompact, dashToCredits, dashToDuffs, duffsToCredits, formatCompactCredits } from '../../src/renderer/src/utils/balance'

const ONE_DASH = 100_000_000n

describe('exact Dash credit amounts', () => {
  it.each<[bigint, string]>([
    [0n, '0'],
    [1n, '0.00000000001'],
    [999n, '0.00000000999'],
    [1_000n, '0.00000001'],
    [100_000_000_000n, '1'],
    [125_000_000_000n, '1.25'],
    [100_000_000_001n, '1.00000000001'],
    [9_007_199_254_740_993n, '90071.99254740993'],
    [900719925474099300000000001n, '9007199254740993.00000000001'],
  ])('displays and round-trips %s credits without truncation', (credits, dash) => {
    expect(creditsToDash(credits)).toBe(dash)
    expect(dashToCredits(dash)).toBe(credits)
  })

  it('formats negative balances without allowing negative input caps', () => {
    expect(creditsToDash(-1n)).toBe('-0.00000000001')
    expect(creditsToDash(-100_000_000_000n)).toBe('-1')
    expect(dashToCredits('-0.00000000001')).toBeNull()
  })

  it.each<[string, bigint]>([
    ['', 0n], ['.', 0n], ['0.', 0n], ['0.000', 0n], ['000', 0n],
    ['1.', 100_000_000_000n], ['.5', 50_000_000_000n],
    ['0.00100', 100_000_000n], ['001.2500', 125_000_000_000n],
    ['1.00000000000', 100_000_000_000n],
  ])('accepts decimal editing input %j', (value, credits) => {
    expect(dashToCredits(value)).toBe(credits)
  })

  it.each([
    '-100', '+100', '1e3', '0x10', '1_000', '12abc', ' 12', '12 ', '12\n', '١٢',
    '1.2.3', '..', '1,5', '0.000000000001', '1.000000000000',
  ])('rejects malformed or overprecise Dash input %j without rounding', value => {
    expect(dashToCredits(value)).toBeNull()
  })
})

describe('compareBigIntsDescending', () => {
  it('orders close values beyond Number precision without disturbing equal values', () => {
    expect([9_007_199_254_740_992n, 0n, 9_007_199_254_740_993n].sort(compareBigIntsDescending)).toEqual([
      9_007_199_254_740_993n, 9_007_199_254_740_992n, 0n,
    ])
    expect(compareBigIntsDescending(9_007_199_254_740_993n, 9_007_199_254_740_993n)).toBe(0)
  })
})

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

  it('rounds a credit balance down to a spend-safe DASH amount', () => {
    for (const credits of [999n, 1_000n, 1_999n, 500_999n, 100_000_000_999n]) {
      expect(duffsToCredits(creditsToDuffs(credits))).toBeLessThanOrEqual(credits)
    }
  })
})

describe('duffsToCredits', () => {
  it('converts each duff to 1000 credits', () => {
    expect(duffsToCredits(1n)).toBe(1_000n)
    expect(duffsToCredits(ONE_DASH)).toBe(100_000_000_000n)
    expect(duffsToCredits(0n)).toBe(0n)
  })

  it('round-trips whole-duff credit amounts', () => {
    for (const credits of [1_000n, 500_000n, 100_000_000_000n]) {
      expect(duffsToCredits(creditsToDuffs(credits))).toBe(credits)
    }
  })

  it('converts a DASH input into the Platform protocol amount', () => {
    expect(duffsToCredits(dashToDuffs('1.25'))).toBe(125_000_000_000n)
    expect(duffsToCredits(dashToDuffs('0.00000001'))).toBe(1_000n)
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
