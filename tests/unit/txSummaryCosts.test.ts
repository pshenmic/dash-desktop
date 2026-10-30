import { describe, it, expect } from 'vitest'
import {
  assetLockLocksFeeOnTop,
  assetLockSummaryCosts,
  resumedAssetLockAmount,
  shieldedSpendSummaryCosts,
} from '../../src/renderer/src/utils/txSummaryCosts'
import { TX_SUMMARY_LABELS } from '../../src/renderer/src/constants/txSummary'
import { AssetLockFundingKind } from '../../src/renderer/src/enums/AssetLockFundingKind'
import { ShieldedSpendKind } from '../../src/renderer/src/enums/ShieldedSpendKind'

describe('assetLockLocksFeeOnTop', () => {
  it('locks the Platform fee on top for address and shielded fundings only', () => {
    expect(assetLockLocksFeeOnTop(AssetLockFundingKind.Address)).toBe(true)
    expect(assetLockLocksFeeOnTop(AssetLockFundingKind.Shielded)).toBe(true)
    expect(assetLockLocksFeeOnTop(AssetLockFundingKind.Identity)).toBe(false)
    expect(assetLockLocksFeeOnTop(AssetLockFundingKind.IdentityTopUp)).toBe(false)
  })
})

describe('resumedAssetLockAmount', () => {
  it('shows the stored lock amount when the lock carries only the amount', () => {
    expect(resumedAssetLockAmount(AssetLockFundingKind.Identity, 10_000_000n)).toBe(10_000_000n)
    expect(resumedAssetLockAmount(AssetLockFundingKind.IdentityTopUp, 5_000_000n)).toBe(5_000_000n)
  })

  it('hides the amount when the lock also carries the Platform fee', () => {
    expect(resumedAssetLockAmount(AssetLockFundingKind.Address, 100_163_000n)).toBeUndefined()
    expect(resumedAssetLockAmount(AssetLockFundingKind.Shielded, 100_163_000n)).toBeUndefined()
  })

  it('hides an unknown amount', () => {
    expect(resumedAssetLockAmount(AssetLockFundingKind.Identity, null)).toBeUndefined()
  })
})

describe('assetLockSummaryCosts', () => {
  it('adds the locked Platform fee as a duffs line and to the total for address and shielded fundings', () => {
    for (const kind of [AssetLockFundingKind.Address, AssetLockFundingKind.Shielded]) {
      expect(assetLockSummaryCosts(kind, 100_000_000n, 2_000n, 163_000_500n)).toEqual({
        fees: [
          { label: TX_SUMMARY_LABELS.networkFee, amount: 2_000n, unit: 'duffs' },
          { label: TX_SUMMARY_LABELS.reservedFee, amount: 163_001n, unit: 'duffs' },
        ],
        total: 100_165_001n,
      })
    }
  })

  it('leaves the total pending while either fee is unknown', () => {
    expect(assetLockSummaryCosts(AssetLockFundingKind.Address, 100_000_000n, null, 163_000_000n).total).toBeNull()
    const pendingLock = assetLockSummaryCosts(AssetLockFundingKind.Shielded, 100_000_000n, 2_000n, null)
    expect(pendingLock.total).toBeNull()
    expect(pendingLock.fees?.[1].amount).toBeNull()
  })

  it('credits the identity the lock less the Platform fee for identity fundings', () => {
    for (const kind of [AssetLockFundingKind.Identity, AssetLockFundingKind.IdentityTopUp]) {
      expect(assetLockSummaryCosts(kind, 10_000_000n, 2_000n, 162_851_200n)).toEqual({
        fees: [{ label: TX_SUMMARY_LABELS.networkFee, amount: 2_000n, unit: 'duffs' }],
        total: 10_002_000n,
        details: [{ label: TX_SUMMARY_LABELS.identityCredited, amount: 9_837_148_800n, unit: 'credits' }],
      })
    }
  })

  it('leaves identity rows pending while their fee is unknown', () => {
    const costs = assetLockSummaryCosts(AssetLockFundingKind.Identity, 10_000_000n, null, null)
    expect(costs.total).toBeNull()
    expect(costs.details?.[0].amount).toBeNull()
  })
})

describe('shieldedSpendSummaryCosts', () => {
  it('debits the amount plus the fee for transfers, unshields and withdrawals', () => {
    for (const kind of [ShieldedSpendKind.Transfer, ShieldedSpendKind.Unshield, ShieldedSpendKind.Withdrawal]) {
      expect(shieldedSpendSummaryCosts(kind, 1_000_000_000n, 163_000_000n)).toEqual({
        fees: [{ label: TX_SUMMARY_LABELS.reservedFee, amount: 163_000_000n, unit: 'credits' }],
        total: 1_163_000_000n,
      })
    }
  })

  it('leaves the total pending while the fee is unknown', () => {
    expect(shieldedSpendSummaryCosts(ShieldedSpendKind.Unshield, 1_000_000_000n, null).total).toBeNull()
  })

  it('debits only the denomination for an identity create and credits it less the fee', () => {
    expect(shieldedSpendSummaryCosts(ShieldedSpendKind.IdentityCreate, 10_000_000_000n, 162_851_200n)).toEqual({
      fees: [{ label: TX_SUMMARY_LABELS.reservedFee, amount: 162_851_200n, unit: 'credits' }],
      total: 10_000_000_000n,
      details: [{ label: TX_SUMMARY_LABELS.identityCredited, amount: 9_837_148_800n, unit: 'credits' }],
    })
  })

  it('keeps the create total while its fee is unknown', () => {
    const costs = shieldedSpendSummaryCosts(ShieldedSpendKind.IdentityCreate, 10_000_000_000n, null)
    expect(costs.total).toBe(10_000_000_000n)
    expect(costs.details?.[0].amount).toBeNull()
  })
})
