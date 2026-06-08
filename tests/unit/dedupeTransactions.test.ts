import { describe, it, expect } from 'vitest'
import { dedupeTransactions } from '../../src/main/src/services/dedupeTransactions'
import { Transaction } from '../../src/main/src/types/Transaction'

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    address: 'X',
    direction: -1,
    inAmount: 0n,
    outAmount: 0n,
    transferAmount: 0n,
    usdAmount: '0.0',
    date: new Date('2026-01-01T00:00:00Z'),
    size: 200,
    blockHeight: 0,
    status: 'Pending',
    walletId: 'w1',
    confirmations: 0,
    txid: 'tx',
    vin: [],
    vout: [],
    ...overrides,
  }
}

describe('dedupeTransactions', () => {
  it('collapses the same txid returned for multiple touched addresses', () => {
    // one pending send fanned out across 3 owned addresses (2 inputs + change)
    const dup = [tx({ txid: 'aaa' }), tx({ txid: 'aaa' }), tx({ txid: 'aaa' })]
    const result = dedupeTransactions(dup)
    expect(result).toHaveLength(1)
    expect(result[0].txid).toBe('aaa')
  })

  it('keeps distinct txids', () => {
    const result = dedupeTransactions([tx({ txid: 'a' }), tx({ txid: 'b' }), tx({ txid: 'c' })])
    expect(result.map(t => t.txid).sort()).toEqual(['a', 'b', 'c'])
  })

  it('keeps the most-confirmed copy when a txid appears with different confirmations', () => {
    const result = dedupeTransactions([
      tx({ txid: 'a', confirmations: 0 }),
      tx({ txid: 'a', confirmations: 7 }),
      tx({ txid: 'a', confirmations: 3 }),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].confirmations).toBe(7)
  })

  it('sorts newest first by date', () => {
    const result = dedupeTransactions([
      tx({ txid: 'old', date: new Date('2026-01-01T00:00:00Z') }),
      tx({ txid: 'new', date: new Date('2026-06-01T00:00:00Z') }),
      tx({ txid: 'mid', date: new Date('2026-03-01T00:00:00Z') }),
    ])
    expect(result.map(t => t.txid)).toEqual(['new', 'mid', 'old'])
  })

  it('returns an empty array for no input', () => {
    expect(dedupeTransactions([])).toEqual([])
  })
})
