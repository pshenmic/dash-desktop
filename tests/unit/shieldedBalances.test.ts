import { describe, it, expect } from 'vitest'
import { shieldedBalancesByAddress } from '../../src/renderer/src/utils/shieldedBalances'
import {ShieldedNoteInfo} from '../../src/main/src/types/Shielded'
const note = (address: string, amount: bigint, spent: boolean, index = 0): ShieldedNoteInfo =>
  ({ index, amount, spent, address })

describe('shieldedBalancesByAddress', () => {
  it('sums unspent note amounts per address', () => {
    const map = shieldedBalancesByAddress([
      note('a', 100n, false),
      note('a', 50n, false),
      note('b', 7n, false),
    ])
    expect(map.get('a')).toBe(150n)
    expect(map.get('b')).toBe(7n)
  })

  it('ignores spent notes', () => {
    const map = shieldedBalancesByAddress([
      note('a', 100n, true),
      note('a', 50n, false),
    ])
    expect(map.get('a')).toBe(50n)
  })

  it('omits addresses with only spent notes', () => {
    const map = shieldedBalancesByAddress([note('a', 100n, true)])
    expect(map.has('a')).toBe(false)
  })

  it('returns an empty map for no notes', () => {
    expect(shieldedBalancesByAddress([]).size).toBe(0)
  })
})
