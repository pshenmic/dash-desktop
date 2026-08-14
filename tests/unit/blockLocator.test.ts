import {describe, it, expect} from 'vitest'
import {buildLocatorHeights} from '../../src/main/p2p/blockLocator'
import {bitsToTarget, headerWork} from '../../src/main/p2p/pow'
import {LOCATOR_DENSE_HEIGHTS, REORG_MAX_DEPTH} from '../../src/main/p2p/constants'

describe('buildLocatorHeights', () => {
  it('starts at the tip and descends without repeating a height', () => {
    const heights = buildLocatorHeights(1000, 976)

    expect(heights[0]).toBe(1000)
    expect(heights).toEqual([...heights].sort((a, b) => b - a))
    expect(new Set(heights).size).toBe(heights.length)
  })

  it('covers every one of the most recent heights before stepping', () => {
    const heights = buildLocatorHeights(1000, 900)
    const dense = heights.slice(0, LOCATOR_DENSE_HEIGHTS)

    expect(dense).toEqual([1000, 999, 998, 997, 996, 995, 994, 993, 992, 991])
  })

  it('always ends on the floor, so the peer has a common ancestor to answer from', () => {
    for (const floor of [1, 5, 900, 999]) {
      const heights = buildLocatorHeights(1000, floor)
      expect(heights[heights.length - 1]).toBe(floor)
      expect(Math.min(...heights)).toBe(floor)
    }
  })

  it('stays short over the reorg window a header race actually asks for', () => {
    const heights = buildLocatorHeights(2_000_000, 2_000_000 - REORG_MAX_DEPTH)
    expect(heights.length).toBeLessThanOrEqual(LOCATOR_DENSE_HEIGHTS + 8)
  })

  it('never descends below the floor when the tip is already near it', () => {
    expect(buildLocatorHeights(3, 1)).toEqual([3, 2, 1])
    expect(buildLocatorHeights(1, 1)).toEqual([1])
  })

  it('clamps a floor at or above the tip rather than looping', () => {
    expect(buildLocatorHeights(10, 50)).toEqual([50])
    expect(buildLocatorHeights(10, 0)).toContain(1)
  })
})

describe('headerWork', () => {
  it('grows as the target shrinks — the ordering branch selection depends on', () => {
    const easy = 0x1e0fffff
    const hard = 0x1b0404cb

    expect(bitsToTarget(hard)).toBeLessThan(bitsToTarget(easy))
    expect(headerWork(hard)).toBeGreaterThan(headerWork(easy))
  })

  it('sums, so a shorter branch at higher difficulty can outweigh a longer one', () => {
    const easy = 0x1e0fffff
    const hard = 0x1b0404cb

    const threeEasy = headerWork(easy) * 3n
    const twoHard = headerWork(hard) * 2n

    expect(twoHard).toBeGreaterThan(threeEasy)
  })

  it('is zero for a degenerate target rather than dividing by it', () => {
    expect(headerWork(0)).toBe(0n)
  })
})
