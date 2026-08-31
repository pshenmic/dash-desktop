import { describe, it, expect } from 'vitest'
import { planWindow } from '../../src/main/src/utils/addressWindow'
import { AddressWindowPolicy } from '../../src/main/src/types/AddressWindow'

const policy = (gapLimit: number, batch = 1): AddressWindowPolicy => ({ gapLimit, batch, maxRounds: 50 })
const GAP = policy(20)

function entries(used: number[], count: number) {
  const usedSet = new Set(used)
  return Array.from({ length: count }, (_, index) => ({ index, isUsed: usedSet.has(index) }))
}

const range = (from: number, length: number) => Array.from({ length }, (_, i) => from + i)

describe('planWindow', () => {
  describe('extend', () => {
    it('returns nothing for a fresh chain with a full unused gap', () => {
      expect(planWindow(entries([], 20), [], GAP).extend).toEqual([])
    })

    it('seeds a full window for an empty chain', () => {
      expect(planWindow([], [], GAP).extend).toEqual(range(0, 20))
    })

    it('extends up to lastUsed + gap when a tail address is used', () => {
      expect(planWindow(entries([19], 20), [], GAP).extend).toEqual(range(20, 20))
    })

    it('extends partially when usage sits mid-chain', () => {
      expect(planWindow(entries([5], 20), [], GAP).extend).toEqual([20, 21, 22, 23, 24, 25])
    })

    it('keeps the gap after repeated extensions', () => {
      expect(planWindow(entries([5, 25], 26), [], GAP).extend).toEqual(range(26, 20))
    })

    it('handles unordered entries', () => {
      expect(planWindow([...entries([19], 20)].reverse(), [], GAP).extend).toHaveLength(20)
    })
  })

  // A scan reports usage for indexes the store has never materialised, so the
  // frontier has to grow from what was observed, not from what exists.
  describe('usage past the materialised window', () => {
    it('extends to an observed used index plus the gap', () => {
      const plan = planWindow(entries([], 50), [{ index: 60, isUsed: true }], policy(50))

      expect(plan.extend).toEqual(range(50, 61))
      expect(plan.extend[plan.extend.length - 1]).toBe(110)
    })

    it('ignores unused observations beyond the window', () => {
      const plan = planWindow(entries([], 20), [{ index: 90, isUsed: false }], GAP)

      expect(plan.extend).toEqual([])
      expect(plan.refill).toEqual([])
    })
  })

  describe('refill', () => {
    it('reports holes below the frontier', () => {
      const known = entries([], 20).filter(entry => entry.index !== 7 && entry.index !== 12)

      expect(planWindow(known, [], GAP).refill).toEqual([7, 12])
    })

    it('is empty for a contiguous chain', () => {
      expect(planWindow(entries([], 20), [], GAP).refill).toEqual([])
    })

    // A hole and a frontier extension are one write, so they must not overlap.
    it('never overlaps the extension', () => {
      const known = entries([19], 20).filter(entry => entry.index !== 3)
      const { refill, extend } = planWindow(known, [], GAP)

      expect(refill).toEqual([3])
      expect(extend[0]).toBe(20)
    })
  })

  // The cfilter scan rewinds its whole in-flight window every time the gap runs
  // short, so an extension that lands exactly on the limit makes the next used
  // address pay for another one.
  describe('batch', () => {
    it('derives a full batch when only one index is short', () => {
      // lastUsed 2, maxIndex 21: the limit alone asks for index 22 and nothing more.
      const chain = entries([2], 22)

      expect(planWindow(chain, [], GAP).extend).toEqual([22])
      expect(planWindow(chain, [], policy(20, 10)).extend).toEqual(range(22, 10))
    })

    it('still reaches the gap limit when that is further than the batch', () => {
      expect(planWindow(entries([19], 20), [], policy(20, 5)).extend).toEqual(range(20, 20))
    })

    it('derives nothing while the gap is already satisfied', () => {
      expect(planWindow(entries([], 20), [], policy(20, 10)).extend).toEqual([])
      expect(planWindow(entries([5], 26), [], policy(20, 10)).extend).toEqual([])
    })

    // A run of used addresses is what the batch exists to absorb: extending by
    // the minimum each time is one rewind per address.
    it('absorbs a run of newly used addresses in fewer extensions', () => {
      const count = (batch: number): number => {
        const used = new Set([0])
        let known = 20
        let rounds = 0
        for (let nextUsed = 1; nextUsed <= 10; nextUsed++) {
          used.add(nextUsed)
          const chain = Array.from({ length: known }, (_, i) => ({ index: i, isUsed: used.has(i) }))
          const added = planWindow(chain, [], policy(20, batch)).extend
          if (added.length > 0) {
            rounds++
            known += added.length
          }
        }
        return rounds
      }

      expect(count(1)).toBe(10)
      expect(count(10)).toBe(2)
    })
  })
})
