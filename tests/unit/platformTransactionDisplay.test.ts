import { describe, expect, it } from 'vitest'
import { bech32m } from '@scure/base'
import type { PlatformTransaction } from '../../src/renderer/src/api/types'
import {
  mapPlatformTransaction,
  platformParticipantUrl,
  platformTransactionDate,
  platformTransactionStatus,
  platformTransactionTitle,
} from '../../src/renderer/src/utils/platformTransactions'
import { formatTransactionCardAmount } from '../../src/renderer/src/utils/walletTransactions'

function transaction(overrides: Partial<PlatformTransaction> = {}): PlatformTransaction {
  const netCredits = overrides.netCredits ?? -1_000n
  return {
    walletId: 'wallet',
    hash: 'ABC123',
    type: 'ADDRESS_FUNDS_TRANSFER',
    date: new Date(2026, 8, 20, 12, 30),
    blockHeight: 123,
    status: 'SUCCESS',
    error: null,
    gasCredits: 1_000n,
    netCredits,
    amountCredits: netCredits < 0n ? -netCredits : netCredits,
    sender: [{ source: 'senderIdentity', amount: 1_000n }],
    recipient: [{ source: 'recipientIdentity', amount: 1_000n }],
    ...overrides,
  }
}

describe('Platform transaction display', () => {
  it('includes all participants on the selected side in the card', () => {
    expect(mapPlatformTransaction(transaction({ sender: [{ source: 'first', amount: 2n }, { source: 'second', amount: 3n }], netCredits: 1n })))
      .toMatchObject({ subtitleLabel: 'From', labelValue: 'first, second' })
    expect(mapPlatformTransaction(transaction({ recipient: [{ source: 'third', amount: 2n }, { source: 'fourth', amount: 3n }] })))
      .toMatchObject({ subtitleLabel: 'To', labelValue: 'third, fourth' })
  })

  it.each([
    { netCredits: 9_007_199_254_740_993n, direction: 'in', status: 'SUCCESS', cardStatus: 'success', subtitleLabel: 'From', labelValue: 'senderIdentity' },
    { netCredits: -9_007_199_254_740_993n, direction: 'out', status: 'FAIL', cardStatus: 'failed', subtitleLabel: 'To', labelValue: 'recipientIdentity' },
    { netCredits: 0n, direction: 'neutral', status: null, cardStatus: 'unknown', subtitleLabel: 'To', labelValue: 'recipientIdentity' },
  ] as const)('maps $direction balance changes without losing credits or inferring status', ({ netCredits, direction, status, cardStatus, subtitleLabel, labelValue }) => {
    const raw = transaction({ netCredits, status })
    expect(mapPlatformTransaction(raw)).toEqual({
      id: raw.hash,
      status: cardStatus,
      kind: 'platform',
      title: 'Address Funds Transfer',
      subtitleLabel,
      labelValue,
      amount: raw.amountCredits,
      date: raw.date,
      direction,
    })
  })

  it('shows what the transition moved, so a transfer between the wallet\u2019s own ends is not displayed as zero', () => {
    expect(mapPlatformTransaction(transaction({ netCredits: 0n, amountCredits: 9_007_199_254_740_993n })))
      .toMatchObject({ amount: 9_007_199_254_740_993n, direction: 'neutral' })
  })

  it('maps unavailable dates to null and falls back to the end the source named', () => {
    expect(mapPlatformTransaction(transaction({ date: new Date(0), recipient: [] })))
      .toMatchObject({ date: null, subtitleLabel: 'From', labelValue: 'senderIdentity' })
    expect(mapPlatformTransaction(transaction({ date: new Date(NaN), sender: [], recipient: [] })))
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

  it('supports unknown operation names', () => {
    expect(platformTransactionTitle('FUTURE_OPERATION')).toBe('Future Operation')
    expect(platformTransactionTitle('')).toBe('Unknown operation')
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
