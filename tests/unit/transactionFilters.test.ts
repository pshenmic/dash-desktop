import { describe, it, expect } from 'vitest'
import type { PlatformTransaction, TransactionOutput } from '../../src/renderer/src/api/types'
import type { TxFilter, WalletTxItem } from '../../src/renderer/src/types/WalletTransaction'
import { DEFAULT_TX_FILTER } from '../../src/renderer/src/constants/transactionFilters'
import {
  activeTxFilterChips,
  changeTxFilterSource,
  computeTxTotals,
  filterTransactions,
  isDefaultTxFilter,
  matchesTxFilter,
  transactionTypeOptions,
  txType,
} from '../../src/renderer/src/utils/transactionFilters'
import { groupWalletHistoryByDay, mergeWalletTransactions } from '../../src/renderer/src/utils/walletTransactions'
import { creditsToDash, duffsToCredits } from '../../src/renderer/src/utils/balance'
import { TxBalanceChangeFilter } from '../../src/renderer/src/enums/TxBalanceChangeFilter'
import { TxTypeFilter } from '../../src/renderer/src/enums/TxTypeFilter'

function output(address: string): TransactionOutput {
  return { address, value: '1.0', n: 0, spentTxId: '', spentIndex: 0, spentHeight: 0 }
}

function coreTransaction(overrides: Partial<WalletTxItem> = {}): WalletTxItem {
  return {
    id: 'core-hash',
    direction: 'in',
    status: 'success',
    kind: 'core',
    amount: 100_000_000n,
    date: new Date(2026, 8, 20, 12),
    title: 'Receive',
    subtitleLabel: 'from',
    labelValue: 'Xwallet',
    usdAmount: '0.0',
    size: 100,
    confirmations: 10,
    blockHeight: 123,
    vin: [{ addr: 'Xsender', value: '1.1', n: 0, prevTxId: 'prev', prevVout: 0, sequence: 0 }],
    vout: [output('Xrecipient')],
    ...overrides,
  }
}

function platformTransaction(overrides: Partial<PlatformTransaction> = {}): PlatformTransaction {
  const netCredits = overrides.netCredits ?? -1_000n
  return {
    walletId: 'wallet',
    hash: 'platform-hash',
    type: 'ADDRESS_FUNDS_TRANSFER',
    date: new Date(2026, 8, 20, 13),
    blockHeight: 123,
    status: 'SUCCESS',
    error: null,
    gasCredits: 1_000n,
    netCredits,
    amountCredits: netCredits < 0n ? -netCredits : netCredits,
    sender: [{ source: 'walletAddress', amount: 1_000n }],
    recipient: [{ source: 'recipientIdentity', amount: 1_000n }],
    ...overrides,
  }
}

describe('merged wallet transaction history', () => {
  it('sorts both unsorted sources together and groups by local day across midnight', () => {
    const core = [
      coreTransaction({ id: 'core-before', date: new Date(2026, 8, 20, 23, 59, 59) }),
      coreTransaction({ id: 'core-after', date: new Date(2026, 8, 21, 0, 0, 1) }),
    ]
    const platform = [
      platformTransaction({ hash: 'platform-before', date: new Date(2026, 8, 20, 23, 59, 58) }),
      platformTransaction({ hash: 'platform-after', date: new Date(2026, 8, 21, 0, 0, 2) }),
    ]
    const history = mergeWalletTransactions(core, platform)
    const groups = groupWalletHistoryByDay(history)

    expect(history.map((tx) => tx.id)).toEqual(['platform-after', 'core-after', 'core-before', 'platform-before'])
    expect(groups.map((group) => group.transactions.map((tx) => tx.id)))
      .toEqual([['platform-after', 'core-after'], ['core-before', 'platform-before']])
    expect(groups.map((group) => group.date)).toEqual([platform[1].date, core[0].date])
    expect(core.map((tx) => tx.id)).toEqual(['core-before', 'core-after'])
    expect(platform.map((tx) => tx.hash)).toEqual(['platform-before', 'platform-after'])
  })

  it('places all unavailable dates last without displaying an epoch or invalid date', () => {
    const history = mergeWalletTransactions([
      coreTransaction({ id: 'core-unknown', date: new Date(NaN) }),
    ], [
      platformTransaction({ hash: 'epoch', date: new Date(0) }),
      platformTransaction({ hash: 'dated' }),
      platformTransaction({ hash: 'invalid', date: new Date(NaN) }),
    ])
    const groups = groupWalletHistoryByDay(history)
    expect(history.map((tx) => tx.id)).toEqual(['dated', 'core-unknown', 'epoch', 'invalid'])
    expect(groups).toHaveLength(2)
    expect(groups[1].date).toBeNull()
    expect(groups[1].transactions.every((tx) => tx.date === null)).toBe(true)
  })

  it('preserves both sources and their detail targets when their identifiers coincide', () => {
    const core = coreTransaction({ id: 'shared', date: new Date(2026, 8, 20, 12) })
    const platform = platformTransaction({ hash: 'shared', date: core.date })
    const history = mergeWalletTransactions([core], [platform])
    expect(history.map((tx) => `${tx.kind}:${tx.id}`)).toEqual(['core:shared', 'platform:shared'])
    expect(history.map((tx) => tx.selection)).toEqual([
      { kind: 'core', transaction: core }, { kind: 'platform', hash: 'shared' },
    ])
    expect(history[0].selection.kind === 'core' && history[0].selection.transaction).toBe(core)
  })

  it('supports either source independently and an empty wallet', () => {
    expect(mergeWalletTransactions([coreTransaction()], [])).toHaveLength(1)
    expect(mergeWalletTransactions([], [platformTransaction()])).toHaveLength(1)
    expect(groupWalletHistoryByDay(mergeWalletTransactions([], []))).toEqual([])
  })
})

describe('transaction type filters', () => {
  it('preserves Core transfer and asset-lock classification', () => {
    expect(txType(coreTransaction())).toBe(TxTypeFilter.Transfer)
    expect(txType(coreTransaction({ vout: [output(''), output('Xchange')] }))).toBe(TxTypeFilter.AssetLock)
  })

  it('namespaces Core and Platform types, deduplicates options and supports future Platform operations', () => {
    const platform = [platformTransaction({ type: 'transfer' }), platformTransaction({ type: 'FUTURE_OPERATION' }), platformTransaction({ type: 'transfer' })]
    expect(transactionTypeOptions(platform)).toEqual([
      { value: 'all', label: 'All' },
      { value: 'core:transfer', label: 'L1 Core: Transfers' },
      { value: 'core:assetLock', label: 'L1 Core: Asset locks' },
      { value: 'platform:FUTURE_OPERATION', label: 'L2 Evo: Future Operation' },
      { value: 'platform:transfer', label: 'L2 Evo: Transfer' },
    ])
    const history = mergeWalletTransactions([coreTransaction(), coreTransaction({ id: 'lock', vout: [output('')] })], platform)
    expect(filterTransactions(history, { ...DEFAULT_TX_FILTER, type: 'core:transfer' }).map((tx) => tx.kind)).toEqual(['core'])
    expect(filterTransactions(history, { ...DEFAULT_TX_FILTER, type: 'core:assetLock' }).map((tx) => tx.id)).toEqual(['lock'])
    expect(filterTransactions(history, { ...DEFAULT_TX_FILTER, type: 'platform:transfer' }).map((tx) => tx.kind)).toEqual(['platform', 'platform'])
  })
})

describe('shared transaction filters', () => {
  const history = mergeWalletTransactions([
    coreTransaction({ id: 'core-in' }),
    coreTransaction({ id: 'core-out', direction: 'out', status: 'pending' }),
    coreTransaction({ id: 'core-failed', direction: 'out', status: 'failed' }),
  ], [
    platformTransaction({ hash: 'platform-in', netCredits: 2n }),
    platformTransaction({ hash: 'platform-out', netCredits: -1n, status: 'FAIL' }),
    platformTransaction({ hash: 'platform-neutral', netCredits: 0n, status: null, sender: [], recipient: [] }),
  ])

  it('filters balance changes across both sources, including fees on failed Platform operations', () => {
    expect(filterTransactions(history, { ...DEFAULT_TX_FILTER, balanceChange: TxBalanceChangeFilter.Increase }).map((tx) => tx.id))
      .toEqual(['platform-in', 'core-in'])
    expect(filterTransactions(history, { ...DEFAULT_TX_FILTER, balanceChange: TxBalanceChangeFilter.Decrease }).map((tx) => tx.id))
      .toEqual(['platform-out', 'core-out'])
    expect(filterTransactions(history, { ...DEFAULT_TX_FILTER, balanceChange: TxBalanceChangeFilter.Unchanged }).map((tx) => tx.id))
      .toEqual(['platform-neutral', 'core-failed'])
  })

  it('filters each source independently and combines source with balance change', () => {
    expect(filterTransactions(history, { ...DEFAULT_TX_FILTER, source: 'core' }).map((tx) => tx.id))
      .toEqual(['core-in', 'core-out', 'core-failed'])
    expect(filterTransactions(history, { ...DEFAULT_TX_FILTER, source: 'platform' }).map((tx) => tx.id))
      .toEqual(['platform-in', 'platform-out', 'platform-neutral'])
    expect(filterTransactions(history, {
      ...DEFAULT_TX_FILTER, source: 'platform', balanceChange: TxBalanceChangeFilter.Decrease,
    }).map((tx) => tx.id)).toEqual(['platform-out'])
    expect(filterTransactions(history, DEFAULT_TX_FILTER)).toEqual(history)
  })

  it('keeps zero amounts in No change even when the Core transaction has a direction', () => {
    const transactions = mergeWalletTransactions([
      coreTransaction({ amount: 0n }), coreTransaction({ amount: 0n, direction: 'out' }),
    ], [])
    expect(filterTransactions(transactions, { ...DEFAULT_TX_FILTER, balanceChange: TxBalanceChangeFilter.Unchanged })).toEqual(transactions)
    expect(filterTransactions(transactions, { ...DEFAULT_TX_FILTER, balanceChange: TxBalanceChangeFilter.Increase })).toEqual([])
    expect(filterTransactions(transactions, { ...DEFAULT_TX_FILTER, balanceChange: TxBalanceChangeFilter.Decrease })).toEqual([])
  })

  it.each([
    ['success', ['platform-in', 'core-in']],
    ['failed', ['platform-out', 'core-failed']],
    ['pending', ['core-out']],
    ['unknown', ['platform-neutral']],
  ] as const)('matches %s status across both sources', (status, expected) => {
    expect(filterTransactions(history, { ...DEFAULT_TX_FILTER, status }).map((tx) => tx.id)).toEqual(expected)
  })

  it('combines source, balance change, namespaced type, status and trimmed case-insensitive search', () => {
    const filter: TxFilter = { source: 'platform', balanceChange: TxBalanceChangeFilter.Decrease, type: 'platform:ADDRESS_FUNDS_TRANSFER', status: 'failed', search: ' PLATFORM-OUT ' }
    expect(filterTransactions(history, filter).map((tx) => tx.id)).toEqual(['platform-out'])
    expect(filterTransactions(history, { ...filter, status: 'success' })).toEqual([])
    expect(filterTransactions(history, { ...filter, type: 'core:transfer' })).toEqual([])
    expect(filterTransactions(history, { ...filter, balanceChange: TxBalanceChangeFilter.Increase })).toEqual([])
    expect(filterTransactions(history, { ...filter, source: 'core' })).toEqual([])
    expect(groupWalletHistoryByDay(filterTransactions(history, { ...filter, search: 'missing' }))).toEqual([])
  })

  it('searches Core identifiers and input/output/display addresses, plus Platform hashes and both participants', () => {
    const [core] = mergeWalletTransactions([coreTransaction()], [])
    const [platform] = mergeWalletTransactions([], [platformTransaction({
      sender: [{ source: 'walletAddress', amount: 2n }, { source: 'secondSender', amount: 3n }],
      recipient: [{ source: 'recipientIdentity', amount: 2n }, { source: 'secondRecipient', amount: 3n }],
    })])
    for (const search of ['CORE-HASH', 'Xsender', 'Xrecipient', ' xWALLET ']) {
      expect(matchesTxFilter(core, { ...DEFAULT_TX_FILTER, search })).toBe(true)
    }
    for (const search of ['PLATFORM-HASH', ' walletADDRESS ', 'recipientIDENTITY', 'secondSender', 'secondRecipient']) {
      expect(matchesTxFilter(platform, { ...DEFAULT_TX_FILTER, search })).toBe(true)
    }
    expect(filterTransactions(history, { ...DEFAULT_TX_FILTER, search: 'missing' })).toEqual([])
    expect(filterTransactions(history, { ...DEFAULT_TX_FILTER, search: '  ' })).toEqual(history)
  })

  it('recognizes all active filter fields and treats a whitespace search as empty', () => {
    expect(isDefaultTxFilter(DEFAULT_TX_FILTER)).toBe(true)
    expect(isDefaultTxFilter({ ...DEFAULT_TX_FILTER, search: '   ' })).toBe(true)
    expect(isDefaultTxFilter({ ...DEFAULT_TX_FILTER, source: 'platform' })).toBe(false)
    expect(isDefaultTxFilter({ ...DEFAULT_TX_FILTER, balanceChange: TxBalanceChangeFilter.Unchanged })).toBe(false)
    expect(isDefaultTxFilter({ ...DEFAULT_TX_FILTER, type: 'core:transfer' })).toBe(false)
    expect(isDefaultTxFilter({ ...DEFAULT_TX_FILTER, status: 'unknown' })).toBe(false)
    expect(isDefaultTxFilter({ ...DEFAULT_TX_FILTER, search: 'hash' })).toBe(false)
  })
})

describe('combined transaction totals', () => {
  it('adds Core duffs and Platform credits at full precision, including sub-duff values and very large balances', () => {
    const large = 9_007_199_254_740_993n
    const history = mergeWalletTransactions([
      coreTransaction({ amount: large }),
      coreTransaction({ direction: 'out', amount: 1n, status: 'pending' }),
    ], [
      platformTransaction({ netCredits: 1n }),
      platformTransaction({ netCredits: -2n }),
    ])
    const totals = computeTxTotals(history)
    expect(totals).toEqual({ receivedCredits: duffsToCredits(large) + 1n, sentCredits: 1_002n })
    expect(creditsToDash(totals.receivedCredits)).toBe('90071992.54740993001')
    expect(creditsToDash(totals.sentCredits)).toBe('0.00000001002')
  })

  it('excludes failed Core transfers but includes actual Platform fee losses, without double-counting gas', () => {
    const history = mergeWalletTransactions([
      coreTransaction({ status: 'failed', amount: 100n }),
      coreTransaction({ status: 'failed', direction: 'out', amount: 200n }),
      coreTransaction({ status: 'pending', amount: 1n }),
    ], [
      platformTransaction({ status: 'FAIL', netCredits: -5n, gasCredits: 5n }),
      platformTransaction({ status: null, netCredits: 1n }),
      platformTransaction({ netCredits: -2n, gasCredits: 100n }),
      platformTransaction({ netCredits: 0n, gasCredits: 10n }),
    ])
    expect(computeTxTotals(history)).toEqual({ receivedCredits: 1_001n, sentCredits: 7n })
  })

  it('totals only the displayed selection and yields zero for no matches', () => {
    const history = mergeWalletTransactions([coreTransaction()], [platformTransaction()])
    expect(computeTxTotals(filterTransactions(history, { ...DEFAULT_TX_FILTER, balanceChange: TxBalanceChangeFilter.Decrease })))
      .toEqual({ receivedCredits: 0n, sentCredits: 1_000n })
    expect(computeTxTotals(filterTransactions(history, { ...DEFAULT_TX_FILTER, search: 'missing' })))
      .toEqual({ receivedCredits: 0n, sentCredits: 0n })
  })
})

describe('transaction filter controls', () => {
  it('offers the existing types for the selected source', () => {
    const platform = [platformTransaction(), platformTransaction({ type: 'FUTURE_OPERATION' })]
    expect(transactionTypeOptions(platform, 'core')).toEqual([
      { value: 'all', label: 'All' },
      { value: 'core:transfer', label: 'L1 Core: Transfers' },
      { value: 'core:assetLock', label: 'L1 Core: Asset locks' },
    ])
    expect(transactionTypeOptions(platform, 'platform')).toEqual([
      { value: 'all', label: 'All' },
      { value: 'platform:ADDRESS_FUNDS_TRANSFER', label: 'L2 Evo: Address Funds Transfer' },
      { value: 'platform:FUTURE_OPERATION', label: 'L2 Evo: Future Operation' },
    ])
    expect(transactionTypeOptions([], 'platform')).toEqual([{ value: 'all', label: 'All' }])
  })

  it('clears an incompatible type when switching source and preserves other conditions', () => {
    const filter: TxFilter = {
      ...DEFAULT_TX_FILTER, source: 'core', type: 'core:transfer',
      balanceChange: TxBalanceChangeFilter.Decrease, search: 'hash', status: 'success',
    }
    expect(changeTxFilterSource(filter, 'platform')).toEqual({ ...filter, source: 'platform', type: 'all' })
    expect(changeTxFilterSource(filter, 'core')).toEqual(filter)
    expect(changeTxFilterSource(filter, 'all')).toEqual({ ...filter, source: 'all' })
    expect(changeTxFilterSource({ ...filter, source: 'platform', type: 'platform:FUTURE_OPERATION' }, 'core'))
      .toEqual({ ...filter, source: 'core', type: 'all' })
  })

  it('makes every active condition visible, including types that narrow All sources', () => {
    expect(activeTxFilterChips({
      source: 'platform', balanceChange: TxBalanceChangeFilter.Decrease,
      type: 'platform:FUTURE_OPERATION', status: 'failed', search: ' hash ',
    })).toEqual([
      { field: 'source', label: 'Source: L2 Evo' },
      { field: 'balanceChange', label: 'Balance change: Decrease' },
      { field: 'type', label: 'Type: L2 Evo: Future Operation' },
      { field: 'status', label: 'Status: Failed' },
      { field: 'search', label: 'Search: hash' },
    ])
    expect(activeTxFilterChips({ ...DEFAULT_TX_FILTER, type: 'core:transfer' }))
      .toEqual([{ field: 'type', label: 'Type: L1 Core: Transfers' }])
    expect(activeTxFilterChips({ ...DEFAULT_TX_FILTER, search: '   ' })).toEqual([])
  })
})
