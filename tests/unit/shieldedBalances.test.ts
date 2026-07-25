import { describe, it, expect } from 'vitest'
import { shieldedBalancesByAddress } from '../../src/renderer/src/utils/shieldedBalances'
import type { ShieldedNoteInfo } from '../../src/renderer/src/api/types'

const note = (address: string, amount: string, spent: boolean, index = 0): ShieldedNoteInfo =>
  ({ index, amount, spent, address })

describe('shieldedBalancesByAddress', () => {
  it('sums unspent note amounts per address', () => {
    const map = shieldedBalancesByAddress([
      note('a', '100', false),
      note('a', '50', false),
      note('b', '7', false),
    ])
    expect(map.get('a')).toBe(150n)
    expect(map.get('b')).toBe(7n)
  })

  it('ignores spent notes', () => {
    const map = shieldedBalancesByAddress([
      note('a', '100', true),
      note('a', '50', false),
    ])
    expect(map.get('a')).toBe(50n)
  })

  it('omits addresses with only spent notes', () => {
    const map = shieldedBalancesByAddress([note('a', '100', true)])
    expect(map.has('a')).toBe(false)
  })

  it('returns an empty map for no notes', () => {
    expect(shieldedBalancesByAddress([]).size).toBe(0)
  })
})
