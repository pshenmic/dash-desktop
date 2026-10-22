import { describe, expect, it } from 'vitest'
import { buildBalanceAllocation, formatAllocationAmount, formatShare } from '../../src/renderer/src/utils/dashboardAnalytics'

describe('formatShare', () => {
  it.each([
    [0, '0'],
    [0.04, '<0.1'],
    [0.099, '<0.1'],
    [0.1, '0.1'],
    [12.345, '12.3'],
    [95.55, '95.5'],
    [100, '100.0'],
  ])('formats %d as %s', (share, expected) => {
    expect(formatShare(share)).toBe(expected)
  })
})

describe('buildBalanceAllocation', () => {
  it('emits Core, Platform, Identities and Shielded segments keyed by series with their shares', () => {
    const allocation = buildBalanceAllocation(100_000_000n, 100_000_000_000n, 100_000_000_000n, 100_000_000_000n)
    expect(allocation.total).toBe(400_000_000_000n)
    expect(allocation.segments).toEqual([
      { label: 'Core', series: 'core', credits: 100_000_000_000n, share: 25 },
      { label: 'Platform addresses', series: 'evo', credits: 100_000_000_000n, share: 25 },
      { label: 'Identities', series: 'identities', credits: 100_000_000_000n, share: 25 },
      { label: 'Shielded', series: 'shielded', credits: 100_000_000_000n, share: 25 },
    ])
  })

  it('counts identity credits in the total', () => {
    const allocation = buildBalanceAllocation(0n, 0n, 7_000n, 3_000n)
    expect(allocation.total).toBe(10_000n)
    expect(allocation.segments.map(segment => segment.share)).toEqual([0, 0, 70, 30])
  })

  it('gives every segment a zero share when the wallet is empty', () => {
    const allocation = buildBalanceAllocation(0n, 0n, 0n, 0n)
    expect(allocation.total).toBe(0n)
    expect(allocation.segments.map(segment => segment.share)).toEqual([0, 0, 0, 0])
  })

  it('puts a lone source at 100%', () => {
    const allocation = buildBalanceAllocation(0n, 5_000n, 0n, 0n)
    expect(allocation.segments.map(segment => [segment.series, segment.share])).toEqual([
      ['core', 0],
      ['evo', 100],
      ['identities', 0],
      ['shielded', 0],
    ])
  })
})

describe('formatAllocationAmount', () => {
  it.each([
    [999n, '<0.001'],
    [1_000n, '<0.001'],
    [0n, '0'],
    [100_000_000n, '0.001'],
    [283_298_983_933_000n, '2832.989'],
  ])('formats %s credits as %s', (credits, expected) => {
    expect(formatAllocationAmount(credits)).toBe(expected)
  })
})
