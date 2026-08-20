import {describe, it, expect} from 'vitest'
import {ChainWindow} from '../../src/main/p2p/store/chainWindow'
import {REORG_MAX_DEPTH} from '../../src/main/p2p/constants'

const hashAt = (height: number): string => height.toString(16).padStart(64, '0')

describe('ChainWindow', () => {
  const filled = (tip: number): ChainWindow => {
    const w = new ChainWindow(tip)
    for (let h = 1; h <= tip; h++) w.record(h, hashAt(h), 1n)
    return w
  }

  it('indexes a recorded header both ways', () => {
    const w = filled(5)

    expect(w.hashAt(3)).toBe(hashAt(3))
    expect(w.heightOf(hashAt(3))).toBe(3)
    expect(w.has(hashAt(3))).toBe(true)
  })

  it('drops entries below the reorg depth', () => {
    const tip = REORG_MAX_DEPTH + 10
    const w = filled(tip)

    expect(w.hashAt(tip)).toBe(hashAt(tip))
    expect(w.hashAt(tip - REORG_MAX_DEPTH)).toBe(hashAt(tip - REORG_MAX_DEPTH))
    expect(w.hashAt(tip - REORG_MAX_DEPTH - 1)).toBeUndefined()
  })

  // The hash index must not outlive the height index, or a locator built from
  // it points at a header nothing can serve.
  it('drops a pruned height from the hash index too', () => {
    const tip = REORG_MAX_DEPTH + 10
    const w = filled(tip)

    expect(w.heightOf(hashAt(1))).toBeUndefined()
    expect(w.has(hashAt(1))).toBe(false)
  })

  // A rewind re-records the fork height with the winning branch's hash before
  // the losing entries are pruned, so the prune must not delete the mapping
  // that replaced it.
  it('keeps the winning hash after a rewind drops the losing branch', () => {
    const w = filled(10)
    w.record(8, 'winner', 5n)

    w.setTip(8)
    w.prune()

    expect(w.heightOf('winner')).toBe(8)
    expect(w.has(hashAt(9))).toBe(false)
    expect(w.has(hashAt(10))).toBe(false)
  })

  it('sums work strictly above the fork height', () => {
    const w = new ChainWindow(4)
    for (let h = 1; h <= 4; h++) w.record(h, hashAt(h), 10n)

    expect(w.workAbove(2)).toBe(20n)
    expect(w.workAbove(4)).toBe(0n)
  })

  it('ignores heights it no longer holds when summing work', () => {
    const tip = REORG_MAX_DEPTH + 5
    const w = filled(tip)

    expect(w.workAbove(0)).toBe(BigInt(REORG_MAX_DEPTH + 1))
  })

  describe('floor()', () => {
    it('never rises above our own tip, however far ahead the chainlock is', () => {
      const w = new ChainWindow(100)

      expect(w.floor(5_000_000)).toBe(100)
    })

    it('sits at the reorg depth when no chainlock is known', () => {
      const w = new ChainWindow(1000)

      expect(w.floor(0)).toBe(1000 - REORG_MAX_DEPTH)
    })

    it('never goes below genesis', () => {
      expect(new ChainWindow(3).floor(0)).toBe(1)
    })
  })

  describe('setTip()', () => {
    it('drops everything above the new tip', () => {
      const tip = REORG_MAX_DEPTH + 10
      const w = filled(tip)

      w.setTip(tip - 5)
      w.prune()

      expect(w.hashAt(tip)).toBeUndefined()
      expect(w.has(hashAt(tip))).toBe(false)
      expect(w.hashAt(tip - 5)).toBe(hashAt(tip - 5))
    })
  })
})
