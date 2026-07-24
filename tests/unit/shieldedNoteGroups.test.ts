import { describe, it, expect } from 'vitest'
import { groupShieldedNotesByAddress } from '../../src/renderer/src/utils/shieldedBalances'
import type { ShieldedNoteInfo } from '../../src/renderer/src/api/types'

const note = (address: string, amount: string, spent: boolean, index = 0): ShieldedNoteInfo =>
  ({ index, amount, spent, address })

describe('groupShieldedNotesByAddress', () => {
  it('groups unspent notes by address with per-address totals', () => {
    const groups = groupShieldedNotesByAddress([
      note('a', '100', false, 1),
      note('a', '50', false, 2),
      note('b', '7', false, 3),
    ])
    expect(groups).toHaveLength(2)
    const a = groups.find((g) => g.address === 'a')!
    expect(a.total).toBe(150n)
    expect(a.notes.map((n) => n.index)).toEqual([1, 2])
    expect(groups.find((g) => g.address === 'b')!.total).toBe(7n)
  })

  it('excludes spent notes and drops all-spent addresses', () => {
    const groups = groupShieldedNotesByAddress([
      note('a', '100', true, 1),
      note('a', '50', false, 2),
      note('b', '7', true, 3),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].address).toBe('a')
    expect(groups[0].total).toBe(50n)
    expect(groups[0].notes).toHaveLength(1)
  })

  it('orders groups by descending total, tie-broken by address', () => {
    const groups = groupShieldedNotesByAddress([
      note('b', '10', false, 1),
      note('a', '100', false, 2),
      note('c', '10', false, 3),
    ])
    expect(groups.map((g) => g.address)).toEqual(['a', 'b', 'c'])
  })

  it('returns an empty array for no notes', () => {
    expect(groupShieldedNotesByAddress([])).toEqual([])
  })
})
