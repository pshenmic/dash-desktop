import { describe, expect, it } from 'vitest'
import { bech32m } from '@scure/base'
import type { PlatformTransaction } from '../../src/renderer/src/api/types'
import { DEFAULT_PLATFORM_TX_FILTER } from '../../src/renderer/src/constants/platformTransactions'
import {
  computePlatformTxTotals,
  filterPlatformTransactions,
  groupPlatformTransactionsByDay,
  mapPlatformTransaction,
  platformParticipantUrl,
  platformTransactionDate,
  platformTransactionStatus,
  platformTransactionTitle,
  platformTransactionTypeOptions,
} from '../../src/renderer/src/utils/platformTransactions'
import { creditsToDash } from '../../src/renderer/src/utils/balance'
import { formatTransactionCardAmount } from '../../src/renderer/src/utils/walletTransactions'

function transaction(overrides: Partial<PlatformTransaction> = {}): PlatformTransaction {
  return {
    walletId: 'wallet',
    hash: 'ABC123',
    type: 'ADDRESS_FUNDS_TRANSFER',
    date: new Date(2026, 8, 20, 12, 30),
    blockHeight: 123,
    status: 'SUCCESS',
    error: null,
    gasCredits: 1_000n,
    netCredits: -1_000n,
    subject: 'walletAddress',
    counterparty: 'recipientIdentity',
    ...overrides,
  }
}

describe('Platform transaction display', () => {
  it.each([
    { netCredits: 9_007_199_254_740_993n, direction: 'in', status: 'SUCCESS', cardStatus: 'success' },
    { netCredits: -9_007_199_254_740_993n, direction: 'out', status: 'FAIL', cardStatus: 'failed' },
    { netCredits: 0n, direction: 'neutral', status: null, cardStatus: 'unknown' },
  ] as const)('maps $direction balance changes without losing credits or inferring status', ({ netCredits, direction, status, cardStatus }) => {
    const raw = transaction({ netCredits, status })
    expect(mapPlatformTransaction(raw)).toEqual({
      id: raw.hash,
      status: cardStatus,
      kind: 'platform',
      title: 'Address Funds Transfer',
      subtitleLabel: 'Counterparty',
      labelValue: raw.counterparty,
      amount: netCredits < 0n ? -netCredits : netCredits,
      date: raw.date,
      direction,
    })
  })

  it('maps unavailable dates to null and falls back to the wallet participant', () => {
    expect(mapPlatformTransaction(transaction({ date: new Date(0), counterparty: null })))
      .toMatchObject({ date: null, subtitleLabel: 'Wallet address or identity', labelValue: 'walletAddress' })
    expect(mapPlatformTransaction(transaction({ date: new Date(NaN), counterparty: null, subject: null })))
      .toMatchObject({ date: null, labelValue: 'Unavailable' })
  })

  it('keeps unknown status distinct from success, failure and pending', () => {
    expect(platformTransactionStatus(null)).toBe('Status unavailable')
    expect(platformTransactionStatus('SUCCESS')).toBe('Success')
    expect(platformTransactionStatus('FAIL')).toBe('Failed')
  })

  it('does not display the epoch or an invalid date as a transaction date', () => {
    expect(platformTransactionDate(new Date(0), true)).toBe('Date unavailable')
    expect(platformTransactionDate(new Date(NaN))).toBe('Date unavailable')
    expect(platformTransactionDate(transaction().date, true)).toBe('20 Sept 2026 12:30')
  })

  it('supports unknown operation names and deduplicates type filters', () => {
    expect(platformTransactionTitle('FUTURE_OPERATION')).toBe('Future Operation')
    expect(platformTransactionTitle('')).toBe('Unknown operation')
    expect(platformTransactionTypeOptions([
      transaction(), transaction(), transaction({ type: 'FUTURE_OPERATION' }),
    ])).toEqual([
      { value: 'all', label: 'All' },
      { value: 'ADDRESS_FUNDS_TRANSFER', label: 'Address Funds Transfer' },
      { value: 'FUTURE_OPERATION', label: 'Future Operation' },
    ])
  })

  it('preserves credit precision and counts only the supplied net changes, including fees on failed transitions', () => {
    const large = 9_007_199_254_740_993n
    const totals = computePlatformTxTotals([
      transaction({ netCredits: large }),
      transaction({ netCredits: 1n, status: null }),
      transaction({ netCredits: -5n, gasCredits: 5n, status: 'FAIL' }),
      transaction({ netCredits: -2n, gasCredits: 100n, subject: null }),
      transaction({ netCredits: 0n, gasCredits: 10n }),
    ])
    expect(totals).toEqual({ increase: large + 1n, decrease: 7n })
    expect(creditsToDash(-1n)).toBe('-0.00000000001')
    expect(computePlatformTxTotals([])).toEqual({ increase: 0n, decrease: 0n })
  })
})

describe('Platform transaction day groups', () => {
  it('groups by the local calendar day across midnight and preserves transaction order', () => {
    const beforeMidnight = transaction({ hash: 'before', date: new Date(2026, 8, 20, 23, 59, 59) })
    const afterMidnight = transaction({ hash: 'after', date: new Date(2026, 8, 21, 0, 0, 0) })
    const sameDay = transaction({ hash: 'same-day', date: new Date(2026, 8, 21, 23, 59, 59) })

    expect(groupPlatformTransactionsByDay([afterMidnight, beforeMidnight, sameDay])).toEqual([
      { date: afterMidnight.date, transactions: [afterMidnight, sameDay] },
      { date: beforeMidnight.date, transactions: [beforeMidnight] },
    ])
  })

  it('keeps unknown dates together without merging them into a dated group', () => {
    const epoch = transaction({ hash: 'epoch', date: new Date(0) })
    const invalid = transaction({ hash: 'invalid', date: new Date(NaN) })
    const dated = transaction()

    expect(groupPlatformTransactionsByDay([epoch, dated, invalid])).toEqual([
      { date: null, transactions: [epoch, invalid] },
      { date: dated.date, transactions: [dated] },
    ])
    expect(groupPlatformTransactionsByDay([])).toEqual([])
  })
})

describe('Transaction card amount formatting', () => {
  it('preserves sub-duff credits in the Platform amount while converting only the fiat input to duffs', () => {
    expect(formatTransactionCardAmount({ kind: 'platform', amount: 1n }))
      .toEqual({ value: '0.00000000001', duffs: 0n })
    expect(formatTransactionCardAmount({ kind: 'platform', amount: 9_007_199_254_740_993n }))
      .toEqual({ value: '90071.99254740993', duffs: 9_007_199_254_740n })
  })

  it('continues to treat Core and unlabelled card amounts as duffs', () => {
    expect(formatTransactionCardAmount({ kind: 'core', amount: 1n }))
      .toEqual({ value: '0.00000001', duffs: 1n })
    expect(formatTransactionCardAmount({ amount: 100_000_001n }))
      .toEqual({ value: '1.00000001', duffs: 100_000_001n })
  })
})

describe('Platform transaction filters', () => {
  const transactions = [
    transaction({ hash: 'increase', netCredits: 2n }),
    transaction({ hash: 'decrease', netCredits: -1n, status: 'FAIL' }),
    transaction({ hash: 'unchanged', netCredits: 0n, status: null, subject: null, counterparty: null }),
  ]

  it('treats a zero change as neutral without inferring an internal transfer', () => {
    for (const direction of ['increase', 'decrease', 'unchanged'] as const) {
      expect(filterPlatformTransactions(transactions, { ...DEFAULT_PLATFORM_TX_FILTER, direction }).map((tx) => tx.hash))
        .toEqual([direction])
    }
  })

  it('combines direction, status, type and trimmed search', () => {
    expect(filterPlatformTransactions(transactions, {
      search: ' DECREASE ', direction: 'decrease', status: 'FAIL', type: 'ADDRESS_FUNDS_TRANSFER',
    }).map((tx) => tx.hash)).toEqual(['decrease'])
    expect(filterPlatformTransactions(transactions, { ...DEFAULT_PLATFORM_TX_FILTER, status: 'unknown' }).map((tx) => tx.hash))
      .toEqual(['unchanged'])
    expect(filterPlatformTransactions(transactions, { ...DEFAULT_PLATFORM_TX_FILTER, type: 'IDENTITY_CREATE' })).toEqual([])
  })

  it('searches the hash and both participants without requiring either participant', () => {
    for (const search of ['aBc', 'WALLET', 'recipient']) {
      expect(filterPlatformTransactions([transaction()], { ...DEFAULT_PLATFORM_TX_FILTER, search })).toHaveLength(1)
    }
    expect(filterPlatformTransactions(transactions, { ...DEFAULT_PLATFORM_TX_FILTER, search: 'missing' })).toEqual([])
    expect(filterPlatformTransactions(transactions, { ...DEFAULT_PLATFORM_TX_FILTER, search: '  ' })).toEqual(transactions)
  })
})

describe('Platform participant explorer links', () => {
  it('links validated addresses and identities on the selected network', () => {
    const address = bech32m.encode('tdash', bech32m.toWords(new Uint8Array(21)))
    const identity = '3MvpYDCTH9RmbpeJU7C1nYe3tLhf28UQA5PMAmKy4TeC'
    expect(platformParticipantUrl(address, 'testnet')).toBe(`https://testnet.platform-explorer.com/platformAddress/${address}`)
    expect(platformParticipantUrl(identity, 'mainnet')).toBe(`https://platform-explorer.com/identity/${identity}`)
    expect(platformParticipantUrl(address, 'mainnet')).toBeNull()
    expect(platformParticipantUrl('unknown-participant', 'testnet')).toBeNull()
    expect(platformParticipantUrl('tdash1invalid', 'testnet')).toBeNull()
  })
})
