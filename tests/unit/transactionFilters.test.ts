import { describe, it, expect } from 'vitest'
import {
  DEFAULT_TX_FILTER,
  FilterableTx,
  TxFilter,
  computeTxTotals,
  filterTransactionGroups,
  filterTransactions,
  isDefaultTxFilter,
  matchesTxFilter,
  txType,
} from '../../src/renderer/src/utils/transactionFilters'
import { TxDirectionFilter } from '../../src/renderer/src/enums/TxDirectionFilter'
import { TxTypeFilter } from '../../src/renderer/src/enums/TxTypeFilter'

const DASH = 100_000_000n

function tx(overrides: Partial<FilterableTx> = {}): FilterableTx {
  return {
    direction: 'in',
    status: 'success',
    amount: DASH,
    vout: [{ value: '1.0', address: 'XaddrA' }],
    ...overrides,
  }
}

function assetLockTx(overrides: Partial<FilterableTx> = {}): FilterableTx {
  return tx({
    direction: 'out',
    vout: [{ value: '0.5' }, { value: '0.4', address: 'XchangeAddr' }],
    ...overrides,
  })
}

describe('txType', () => {
  it('classifies a tx with only addressed outputs as a transfer', () => {
    expect(txType(tx())).toBe(TxTypeFilter.Transfer)
  })

  it('classifies a tx with an address-less output as an asset lock', () => {
    expect(txType(assetLockTx())).toBe(TxTypeFilter.AssetLock)
  })

  it('treats an empty-string address as address-less', () => {
    expect(txType(tx({ vout: [{ value: '0.5', address: '' }] }))).toBe(TxTypeFilter.AssetLock)
  })
})

describe('matchesTxFilter', () => {
  it('matches everything with the default filter', () => {
    expect(matchesTxFilter(tx(), DEFAULT_TX_FILTER)).toBe(true)
    expect(matchesTxFilter(assetLockTx(), DEFAULT_TX_FILTER)).toBe(true)
  })

  it('filters by direction', () => {
    const received: TxFilter = { direction: TxDirectionFilter.Received, type: TxTypeFilter.All }
    expect(matchesTxFilter(tx({ direction: 'in' }), received)).toBe(true)
    expect(matchesTxFilter(tx({ direction: 'out' }), received)).toBe(false)

    const sent: TxFilter = { direction: TxDirectionFilter.Sent, type: TxTypeFilter.All }
    expect(matchesTxFilter(tx({ direction: 'in' }), sent)).toBe(false)
    expect(matchesTxFilter(tx({ direction: 'out' }), sent)).toBe(true)
  })

  it('filters by type', () => {
    const transfers: TxFilter = { direction: TxDirectionFilter.All, type: TxTypeFilter.Transfer }
    expect(matchesTxFilter(tx(), transfers)).toBe(true)
    expect(matchesTxFilter(assetLockTx(), transfers)).toBe(false)

    const assetLocks: TxFilter = { direction: TxDirectionFilter.All, type: TxTypeFilter.AssetLock }
    expect(matchesTxFilter(tx(), assetLocks)).toBe(false)
    expect(matchesTxFilter(assetLockTx(), assetLocks)).toBe(true)
  })

  it('requires both direction and type to match', () => {
    const filter: TxFilter = { direction: TxDirectionFilter.Sent, type: TxTypeFilter.AssetLock }
    expect(matchesTxFilter(assetLockTx({ direction: 'out' }), filter)).toBe(true)
    expect(matchesTxFilter(assetLockTx({ direction: 'in' }), filter)).toBe(false)
    expect(matchesTxFilter(tx({ direction: 'out' }), filter)).toBe(false)
  })
})

describe('filterTransactions', () => {
  it('keeps only matching transactions', () => {
    const txs = [tx({ direction: 'in' }), tx({ direction: 'out' }), assetLockTx()]
    const sent = filterTransactions(txs, { direction: TxDirectionFilter.Sent, type: TxTypeFilter.All })
    expect(sent).toHaveLength(2)
    expect(sent.every((t) => t.direction === 'out')).toBe(true)
  })
})

describe('filterTransactionGroups', () => {
  it('drops groups with no matching transactions and preserves dates', () => {
    const groups = [
      { date: '01/06/2026', transactions: [tx({ direction: 'in' })] },
      { date: '02/06/2026', transactions: [tx({ direction: 'out' }), tx({ direction: 'in' })] },
    ]
    const filtered = filterTransactionGroups(groups, {
      direction: TxDirectionFilter.Sent,
      type: TxTypeFilter.All,
    })
    expect(filtered).toHaveLength(1)
    expect(filtered[0].date).toBe('02/06/2026')
    expect(filtered[0].transactions).toHaveLength(1)
  })

  it('returns all groups unchanged for the default filter', () => {
    const groups = [
      { date: '01/06/2026', transactions: [tx(), assetLockTx()] },
    ]
    const filtered = filterTransactionGroups(groups, DEFAULT_TX_FILTER)
    expect(filtered).toHaveLength(1)
    expect(filtered[0].transactions).toHaveLength(2)
  })
})

describe('computeTxTotals', () => {
  it('sums received and sent separately', () => {
    const totals = computeTxTotals([
      tx({ direction: 'in', amount: 3n * DASH }),
      tx({ direction: 'in', amount: DASH }),
      tx({ direction: 'out', amount: 2n * DASH }),
    ])
    expect(totals.received).toBe(4n * DASH)
    expect(totals.sent).toBe(2n * DASH)
  })

  it('excludes failed transactions from totals', () => {
    const totals = computeTxTotals([
      tx({ status: 'failed', amount: 5n * DASH }),
      tx({ direction: 'out', status: 'failed', amount: 5n * DASH }),
      tx({ amount: DASH }),
    ])
    expect(totals.received).toBe(DASH)
    expect(totals.sent).toBe(0n)
  })

  it('includes pending transactions in totals', () => {
    const totals = computeTxTotals([tx({ status: 'pending', amount: 2n * DASH })])
    expect(totals.received).toBe(2n * DASH)
  })

  it('returns zero totals for an empty list', () => {
    expect(computeTxTotals([])).toEqual({ received: 0n, sent: 0n })
  })
})

describe('isDefaultTxFilter', () => {
  it('detects the default filter', () => {
    expect(isDefaultTxFilter(DEFAULT_TX_FILTER)).toBe(true)
    expect(isDefaultTxFilter({ direction: TxDirectionFilter.All, type: TxTypeFilter.All })).toBe(true)
  })

  it('detects a non-default filter', () => {
    expect(isDefaultTxFilter({ direction: TxDirectionFilter.Sent, type: TxTypeFilter.All })).toBe(false)
    expect(isDefaultTxFilter({ direction: TxDirectionFilter.All, type: TxTypeFilter.Transfer })).toBe(false)
  })
})
