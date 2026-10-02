import { describe, expect, it } from 'vitest'
import { bech32m } from '@scure/base'
import type { PlatformTransaction } from '../../src/renderer/src/api/types'
import type { WalletTransactionOwnership } from '../../src/renderer/src/types/WalletTransaction'
import {
  mapPlatformTransaction,
  platformInternalTransferFee,
  platformParticipantUrl,
  platformTransactionDate,
  platformTransactionStatus,
  platformTransactionTitle,
} from '../../src/renderer/src/utils/platformTransactions'
import { formatTransactionCardAmount, mergeWalletTransactions } from '../../src/renderer/src/utils/walletTransactions'
import { computeTxTotals } from '../../src/renderer/src/utils/transactionFilters'

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

  it('shows what the transition moved, so a transfer between the wallet\u2019s own participants is not displayed as zero', () => {
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

describe('Platform internal transfers', () => {
  function ownership(): WalletTransactionOwnership {
    return {
      walletId: 'wallet',
      core: new Set(['ownCore']),
      platform: new Set(['ownPlatform', 'otherOwnPlatform']),
      identities: new Set(['senderIdentity', 'recipientIdentity']),
    }
  }

  function addressTransfer(overrides: Partial<PlatformTransaction> = {}): PlatformTransaction {
    return transaction({
      hash: '87409956A626C016BC36F28BDFCDBC154157E6D032DABB428C2BA7D589650AE2',
      netCredits: 0n,
      gasCredits: 3_234_380n,
      amountCredits: 94_219_326_000n,
      sender: [{ source: 'ownPlatform', amount: 94_219_326_000n }],
      recipient: [{ source: 'otherOwnPlatform', amount: 94_219_326_000n }],
      ...overrides,
    })
  }

  it('restores an indexed self transfer and its actual gas from fresh transaction and ownership data', () => {
    const raw = addressTransfer()
    expect(platformInternalTransferFee(raw, ownership())).toBe(3_234_380n)
    expect(platformInternalTransferFee(structuredClone(raw), ownership())).toBe(3_234_380n)
  })

  it('accepts several visible owned ends and uses gas rather than the displayed net or principal', () => {
    const raw = addressTransfer({
      netCredits: -7n,
      sender: [
        { source: 'ownPlatform', amount: 50_000_000_000n },
        { source: 'otherOwnPlatform', amount: 50_000_000_007n },
      ],
      recipient: [
        { source: 'ownPlatform', amount: 100_000_000_000n },
        { source: 'otherOwnPlatform', amount: 1n },
      ],
    })
    expect(platformInternalTransferFee(raw, ownership())).toBe(3_234_380n)
  })

  it.each([
    { sender: [] },
    { recipient: [] },
    { sender: [{ source: 'externalPlatform', amount: 100_000_000_000n }] },
    { recipient: [{ source: 'externalPlatform', amount: 100_000_000_000n }] },
    { recipient: [{ source: 'ownPlatform', amount: 50_000_000_000n }, { source: 'externalPlatform', amount: 50_000_000_000n }] },
    { sender: [{ source: 'ownPlatform', amount: 0n }] },
    { recipient: [{ source: 'ownPlatform', amount: -1n }] },
    { gasCredits: 0n },
    { status: 'FAIL' as const },
    { status: null },
    { error: 'failed' },
    { blockHeight: null },
    { blockHeight: 0 },
    { walletId: 'another-wallet' },
    { type: 'FUTURE_OPERATION' },
  ])('leaves unavailable, external or unsuccessful address transfer data unchanged', (overrides) => {
    const raw = addressTransfer(overrides)
    expect(platformInternalTransferFee(raw, ownership())).toBeNull()
    expect(mapPlatformTransaction(raw)).toMatchObject({ amount: raw.amountCredits, title: platformTransactionTitle(raw.type) })
  })

  it('does not call an unshield loss a fee when shielded change may be unreadable', () => {
    const raw = transaction({
      type: 'UNSHIELD',
      netCredits: -90_000_000_000n,
      gasCredits: 168_934_000n,
      amountCredits: 100_000_000_000n,
      sender: [{ source: 'ownShielded', amount: 100_000_000_000n }],
      recipient: [{ source: 'ownPlatform', amount: 10_000_000_000n }],
    })
    expect(platformInternalTransferFee(raw, ownership())).toBeNull()
    expect(mapPlatformTransaction(raw)).toMatchObject({ title: 'Unshield', amount: raw.amountCredits })
  })

  it.each(['CREDIT_TRANSFER', 'IDENTITY_CREDIT_TRANSFER'])('recognizes the complete one-to-one identity operation %s', (type) => {
    const raw = transaction({ type, status: null, blockHeight: null, netCredits: 0n, gasCredits: 7_927_360n })
    expect(platformInternalTransferFee(raw, ownership())).toBe(7_927_360n)
  })

  it.each([
    { sender: [{ source: 'externalIdentity', amount: 1_000n }] },
    { recipient: [{ source: 'externalIdentity', amount: 1_000n }] },
    { sender: [{ source: 'senderIdentity', amount: 500n }, { source: 'recipientIdentity', amount: 500n }] },
    { recipient: [{ source: 'recipientIdentity', amount: 999n }] },
    { recipient: [{ source: 'senderIdentity', amount: 1_000n }] },
    { gasCredits: 0n },
    { status: 'FAIL' as const },
    { error: 'rejected' },
  ])('requires owned complete identity ends and actual gas', (overrides) => {
    expect(platformInternalTransferFee(transaction({ type: 'CREDIT_TRANSFER', ...overrides }), ownership())).toBeNull()
  })

  it('maps only enriched metadata to the fee while preserving the original operation and principal', () => {
    const raw = addressTransfer({ gasCredits: 1n })
    const fee = platformInternalTransferFee(raw, ownership())!
    const presented = { ...raw, internalTransferFeeCredits: fee }
    expect(mapPlatformTransaction(presented)).toMatchObject({ title: 'Internal transfer', amount: 1n, direction: 'out' })
    expect(mapPlatformTransaction(raw)).toMatchObject({ title: 'Address Funds Transfer', amount: 94_219_326_000n, direction: 'neutral' })
    expect(raw.type).toBe('ADDRESS_FUNDS_TRANSFER')
    expect(raw.amountCredits).toBe(94_219_326_000n)
    const history = mergeWalletTransactions([], [presented])
    expect(history[0]).toMatchObject({ title: 'Internal transfer', amount: 1n, type: 'platform:ADDRESS_FUNDS_TRANSFER' })
    expect(computeTxTotals(history)).toEqual({ receivedCredits: 0n, sentCredits: 1n })
    expect(formatTransactionCardAmount(history[0])).toEqual({ value: '0.00000000001', duffs: 0n })
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
