import { TX_SUMMARY_LABELS } from '../constants/txSummary'
import { AssetLockFundingKind } from '../enums/AssetLockFundingKind'
import { ShieldedSpendKind } from '../enums/ShieldedSpendKind'
import type { TxSummaryLine, TxSummaryProps } from '../types/TxSummary'
import { duffsToCredits, lockedFeeDuffs } from './balance'

export function assetLockLocksFeeOnTop(kind: AssetLockFundingKind): boolean {
  return kind === AssetLockFundingKind.Address || kind === AssetLockFundingKind.Shielded
}

export function resumedAssetLockAmount(kind: AssetLockFundingKind, lockedDuffs: bigint | null): bigint | undefined {
  return lockedDuffs === null || assetLockLocksFeeOnTop(kind) ? undefined : lockedDuffs
}

export function assetLockSummaryCosts(
  kind: AssetLockFundingKind,
  amountDuffs: bigint,
  feeDuffs: bigint | null,
  feeCredits: bigint | null,
): Pick<TxSummaryProps, 'fees' | 'total' | 'details'> {
  const networkFee: TxSummaryLine = { label: TX_SUMMARY_LABELS.networkFee, amount: feeDuffs, unit: 'duffs' }
  if (assetLockLocksFeeOnTop(kind)) {
    const lockedFee = feeCredits === null ? null : lockedFeeDuffs(feeCredits)
    return {
      fees: [networkFee, { label: TX_SUMMARY_LABELS.reservedFee, amount: lockedFee, unit: 'duffs' }],
      total: feeDuffs === null || lockedFee === null ? null : amountDuffs + feeDuffs + lockedFee,
    }
  }
  return {
    fees: [networkFee],
    total: feeDuffs === null ? null : amountDuffs + feeDuffs,
    details: [{
      label: TX_SUMMARY_LABELS.identityCredited,
      amount: feeCredits === null ? null : duffsToCredits(amountDuffs) - feeCredits,
      unit: 'credits',
    }],
  }
}

export function shieldedSpendSummaryCosts(
  kind: ShieldedSpendKind,
  amountCredits: bigint,
  feeCredits: bigint | null,
): Pick<TxSummaryProps, 'fees' | 'total' | 'details'> {
  const fees: TxSummaryLine[] = [{ label: TX_SUMMARY_LABELS.reservedFee, amount: feeCredits, unit: 'credits' }]
  if (kind === ShieldedSpendKind.IdentityCreate) {
    return {
      fees,
      total: amountCredits,
      details: [{
        label: TX_SUMMARY_LABELS.identityCredited,
        amount: feeCredits === null ? null : amountCredits - feeCredits,
        unit: 'credits',
      }],
    }
  }
  return { fees, total: feeCredits === null ? null : amountCredits + feeCredits }
}
