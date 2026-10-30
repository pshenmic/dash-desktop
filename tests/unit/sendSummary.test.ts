import { describe, it, expect } from 'vitest'
import { sendSummary } from '../../src/renderer/src/utils/sendSummary'
import { NEW_IDENTITY_LABEL } from '../../src/renderer/src/constants/identityRegistration'
import { OPERATION_FUNDING_KINDS } from '../../src/renderer/src/constants/sendPages'
import { POOL_IDENTITY_LABEL } from '../../src/renderer/src/constants/sendSummary'
import { TX_SUMMARY_LABELS } from '../../src/renderer/src/constants/txSummary'
import { AssetLockFundingKind } from '../../src/renderer/src/enums/AssetLockFundingKind'
import { DestinationKind } from '../../src/renderer/src/enums/DestinationKind'
import { ShieldedSpendKind } from '../../src/renderer/src/enums/ShieldedSpendKind'
import { TransferOperation } from '../../src/renderer/src/enums/TransferOperation'
import { TxEndpointKind } from '../../src/renderer/src/enums/TxEndpointKind'
import type { SendSummaryInput, TxSummaryEndpoint } from '../../src/renderer/src/types/TxSummary'
import { assetLockSummaryCosts, shieldedSpendSummaryCosts } from '../../src/renderer/src/utils/txSummaryCosts'

const FROM: TxSummaryEndpoint = { value: 'Automatic', kind: TxEndpointKind.Label }

function input(overrides: Partial<SendSummaryInput> & Pick<SendSummaryInput, 'operation'>): SendSummaryInput {
  return {
    from: FROM,
    destination: DestinationKind.PlatformAddress,
    toDisplay: 'dest',
    coreRecipients: [],
    platformRecipients: [],
    amountDuffs: 0n,
    amountCredits: 0n,
    feeDuffs: null,
    feeCredits: null,
    totalDebitCredits: 0n,
    ...overrides,
  }
}

describe('sendSummary for a Core send', () => {
  const coreRecipients = [
    { address: 'yA', amountDuffs: 100_000n },
    { address: 'yB', amountDuffs: 200_000n },
  ]

  it('sums the recipients and adds the network fee to the total', () => {
    expect(sendSummary(input({
      operation: TransferOperation.CoreSend,
      destination: DestinationKind.CoreAddress,
      coreRecipients,
      amountDuffs: 999n,
      feeDuffs: 1_000n,
    }))).toEqual({
      unit: 'duffs',
      amount: 300_000n,
      from: FROM,
      to: [
        { value: 'yA', kind: TxEndpointKind.Address, amount: 100_000n },
        { value: 'yB', kind: TxEndpointKind.Address, amount: 200_000n },
      ],
      fees: [{ label: TX_SUMMARY_LABELS.networkFee, amount: 1_000n, unit: 'duffs' }],
      total: 301_000n,
    })
  })

  it('leaves the fee and total pending while the fee is unknown', () => {
    const summary = sendSummary(input({ operation: TransferOperation.CoreSend, coreRecipients }))
    expect(summary.fees?.[0].amount).toBeNull()
    expect(summary.total).toBeNull()
  })
})

describe('sendSummary for an asset lock', () => {
  const LOCK_OPERATIONS = [
    TransferOperation.AssetLockFunding,
    TransferOperation.AssetLockShield,
    TransferOperation.IdentityRegister,
    TransferOperation.IdentityTopUpL1,
  ]

  it('builds its costs exactly as the funding popup does', () => {
    for (const operation of LOCK_OPERATIONS) {
      const kind = OPERATION_FUNDING_KINDS[operation] as AssetLockFundingKind
      const summary = sendSummary(input({ operation, amountDuffs: 10_000_000n, feeDuffs: 2_000n, feeCredits: 162_851_200n }))
      expect(summary).toMatchObject({ unit: 'duffs', amount: 10_000_000n, from: FROM })
      expect({ fees: summary.fees, total: summary.total, details: summary.details })
        .toEqual(assetLockSummaryCosts(kind, 10_000_000n, 2_000n, 162_851_200n))
    }
  })

  it('splits the network fee from the locked Platform fee when the lock carries it on top', () => {
    const summary = sendSummary(input({
      operation: TransferOperation.AssetLockFunding,
      toDisplay: 'tdash1abc',
      amountDuffs: 100_000_000n,
      feeDuffs: 2_000n,
      feeCredits: 163_000_500n,
    }))
    expect(summary.to).toEqual([{ value: 'tdash1abc', kind: TxEndpointKind.Address }])
    expect(summary.fees).toEqual([
      { label: TX_SUMMARY_LABELS.networkFee, amount: 2_000n, unit: 'duffs' },
      { label: TX_SUMMARY_LABELS.reservedFee, amount: 163_001n, unit: 'duffs' },
    ])
    expect(summary.total).toBe(100_165_001n)
  })

  it('marks an L1 shielding destination as shielded', () => {
    expect(sendSummary(input({ operation: TransferOperation.AssetLockShield, destination: DestinationKind.Shielded, toDisplay: 'shielded1' })).to)
      .toEqual([{ value: 'shielded1', kind: TxEndpointKind.Shielded }])
  })

  it('labels the identity a registration creates whatever the page shows as its destination', () => {
    expect(sendSummary(input({ operation: TransferOperation.IdentityRegister, destination: DestinationKind.NewIdentity, toDisplay: 'New identity' })).to)
      .toEqual([{ value: NEW_IDENTITY_LABEL, kind: TxEndpointKind.Label }])
  })

  it('credits a topped-up identity the lock less the Platform fee', () => {
    const summary = sendSummary(input({
      operation: TransferOperation.IdentityTopUpL1,
      destination: DestinationKind.Identity,
      toDisplay: 'identity-id',
      amountDuffs: 10_000_000n,
      feeDuffs: 2_000n,
      feeCredits: 162_851_200n,
    }))
    expect(summary.to).toEqual([{ value: 'identity-id', kind: TxEndpointKind.Address }])
    expect(summary.fees).toEqual([{ label: TX_SUMMARY_LABELS.networkFee, amount: 2_000n, unit: 'duffs' }])
    expect(summary.total).toBe(10_002_000n)
    expect(summary.details).toEqual([{ label: TX_SUMMARY_LABELS.identityCredited, amount: 9_837_148_800n, unit: 'credits' }])
  })

  it('leaves the total pending while the fee is unknown', () => {
    for (const operation of LOCK_OPERATIONS) {
      expect(sendSummary(input({ operation, amountDuffs: 10_000_000n })).total).toBeNull()
    }
  })
})

describe('sendSummary for a Platform transition', () => {
  const platformRecipients = [
    { address: 'tdash1a', amountCredits: 100_000_000n },
    { address: 'tdash1b', amountCredits: 200_000_000n },
  ]

  it('shows the debit with the reserved fee as its total', () => {
    expect(sendSummary(input({
      operation: TransferOperation.IdentityWithdrawal,
      destination: DestinationKind.CoreAddress,
      toDisplay: 'yCore',
      amountCredits: 1_000_000_000n,
      feeCredits: 163_000_000n,
      totalDebitCredits: 1_163_000_000n,
    }))).toEqual({
      unit: 'credits',
      amount: 1_000_000_000n,
      from: FROM,
      to: [{ value: 'yCore', kind: TxEndpointKind.Address }],
      fees: [{ label: TX_SUMMARY_LABELS.reservedFee, amount: 163_000_000n, unit: 'credits' }],
      total: 1_163_000_000n,
    })
  })

  it('takes the total from the debit rather than adding the fee again', () => {
    expect(sendSummary(input({
      operation: TransferOperation.AddressFundsTransfer,
      platformRecipients,
      feeOutputIndex: 1,
      amountCredits: 300_000_000n,
      feeCredits: 5_000_000n,
      totalDebitCredits: 300_000_000n,
    })).total).toBe(300_000_000n)
  })

  it('lists every address transfer recipient and flags the one that pays the fee', () => {
    expect(sendSummary(input({
      operation: TransferOperation.AddressFundsTransfer,
      platformRecipients,
      feeOutputIndex: 1,
    })).to).toEqual([
      { value: 'tdash1a', kind: TxEndpointKind.Address, amount: 100_000_000n, paysFee: false },
      { value: 'tdash1b', kind: TxEndpointKind.Address, amount: 200_000_000n, paysFee: true },
    ])
  })

  it('flags no fee payer when the sender pays the fee', () => {
    expect(sendSummary(input({ operation: TransferOperation.AddressFundsTransfer, platformRecipients })).to.map(endpoint => endpoint.paysFee))
      .toEqual([false, false])
  })

  it('labels the identity a Platform create makes', () => {
    expect(sendSummary(input({ operation: TransferOperation.IdentityCreate, destination: DestinationKind.NewIdentity, toDisplay: 'New identity' })).to)
      .toEqual([{ value: 'New identity', kind: TxEndpointKind.Label }])
  })

  it('shows a single address or identity destination', () => {
    for (const operation of [
      TransferOperation.IdentityTopUp,
      TransferOperation.AddressWithdrawal,
      TransferOperation.IdentityToAddress,
      TransferOperation.IdentityToIdentity,
    ]) {
      expect(sendSummary(input({ operation, toDisplay: 'dest' })).to).toEqual([{ value: 'dest', kind: TxEndpointKind.Address }])
    }
  })

  it('marks a shield destination as shielded and totals the debit', () => {
    expect(sendSummary(input({
      operation: TransferOperation.Shield,
      destination: DestinationKind.Shielded,
      toDisplay: 'shielded1',
      amountCredits: 1_000_000_000n,
      feeCredits: 163_000_000n,
      totalDebitCredits: 1_163_000_000n,
    }))).toEqual({
      unit: 'credits',
      amount: 1_000_000_000n,
      from: FROM,
      to: [{ value: 'shielded1', kind: TxEndpointKind.Shielded }],
      fees: [{ label: TX_SUMMARY_LABELS.reservedFee, amount: 163_000_000n, unit: 'credits' }],
      total: 1_163_000_000n,
    })
  })

  it('leaves the fee and total pending while the fee is unknown', () => {
    for (const operation of [TransferOperation.AddressFundsTransfer, TransferOperation.Shield, TransferOperation.IdentityToIdentity]) {
      const summary = sendSummary(input({ operation, amountCredits: 1_000_000_000n, totalDebitCredits: 1_000_000_000n }))
      expect(summary.fees?.[0].amount).toBeNull()
      expect(summary.total).toBeNull()
    }
  })
})

describe('sendSummary for a pool spend', () => {
  it('builds its costs exactly as the spend popup does', () => {
    for (const [operation, kind] of [
      [TransferOperation.ShieldedTransfer, ShieldedSpendKind.Transfer],
      [TransferOperation.Unshield, ShieldedSpendKind.Unshield],
      [TransferOperation.ShieldedWithdrawal, ShieldedSpendKind.Withdrawal],
      [TransferOperation.IdentityCreateFromShielded, ShieldedSpendKind.IdentityCreate],
    ] as const) {
      const summary = sendSummary(input({ operation, amountCredits: 10_000_000_000n, feeCredits: 162_851_200n, totalDebitCredits: 1n }))
      expect(summary).toMatchObject({ unit: 'credits', amount: 10_000_000_000n, from: FROM })
      expect({ fees: summary.fees, total: summary.total, details: summary.details })
        .toEqual(shieldedSpendSummaryCosts(kind, 10_000_000_000n, 162_851_200n))
    }
  })

  it('lists every shielded transfer recipient as a shielded endpoint', () => {
    expect(sendSummary(input({
      operation: TransferOperation.ShieldedTransfer,
      destination: DestinationKind.Shielded,
      platformRecipients: [{ address: 'shielded1', amountCredits: 500n }, { address: 'shielded2', amountCredits: 700n }],
    })).to).toEqual([
      { value: 'shielded1', kind: TxEndpointKind.Shielded, amount: 500n },
      { value: 'shielded2', kind: TxEndpointKind.Shielded, amount: 700n },
    ])
  })

  it('shows an unshield or withdrawal destination as an address', () => {
    for (const operation of [TransferOperation.Unshield, TransferOperation.ShieldedWithdrawal]) {
      expect(sendSummary(input({ operation, toDisplay: 'dest', platformRecipients: [{ address: 'ignored', amountCredits: 1n }] })).to)
        .toEqual([{ value: 'dest', kind: TxEndpointKind.Address }])
    }
  })

  it('totals an identity create at its denomination and credits the identity less the fee', () => {
    const summary = sendSummary(input({
      operation: TransferOperation.IdentityCreateFromShielded,
      destination: DestinationKind.NewIdentity,
      toDisplay: 'New identity',
      amountCredits: 10_000_000_000n,
      feeCredits: 162_851_200n,
      totalDebitCredits: 10_162_851_200n,
    }))
    expect(summary.to).toEqual([{ value: POOL_IDENTITY_LABEL, kind: TxEndpointKind.Label }])
    expect(summary.total).toBe(10_000_000_000n)
    expect(summary.details).toEqual([{ label: TX_SUMMARY_LABELS.identityCredited, amount: 9_837_148_800n, unit: 'credits' }])
  })

  it('leaves a transfer total pending while the fee is unknown', () => {
    expect(sendSummary(input({ operation: TransferOperation.Unshield, amountCredits: 1_000_000_000n })).total).toBeNull()
  })
})
