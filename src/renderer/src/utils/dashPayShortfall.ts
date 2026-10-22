import { FEE_SHORTFALL_COPY } from '@renderer/constants/dashPay'
import { ShortfallKind } from '@renderer/enums/DashPay'
import type { Shortfall } from '@renderer/types/DashPay'
import type { KeysShortfallInput } from '@renderer/types/DashPayKeys'
import { creditsToDash } from './balance'
import { keySlotsLeftLabel } from './dashPayKeySetup'

export function creditShortfall(balance: bigint, fee: bigint | null): bigint | null {
  if (fee == null || balance >= fee) return null
  return fee - balance
}

export function feeShortfall(feeError: boolean, balance: bigint, fee: bigint | null): Shortfall | null {
  if (feeError) return { kind: ShortfallKind.FeeError }
  const missingCredits = creditShortfall(balance, fee)
  return missingCredits == null ? null : { kind: ShortfallKind.Balance, missingCredits }
}

export function keysShortfall({ requested, slotsLeft, feeCredits, feeError, balance }: KeysShortfallInput): Shortfall | null {
  if (requested > slotsLeft) return { kind: ShortfallKind.Slots, slotsLeft }
  return feeShortfall(feeError != null, balance, feeCredits)
}

export function shortfallMessage(shortfall: Shortfall, name: string): string {
  if (shortfall.kind === ShortfallKind.Slots) return keySlotsLeftLabel(shortfall.slotsLeft)
  if (shortfall.kind === ShortfallKind.FeeError) return FEE_SHORTFALL_COPY.feeError
  return `${name} ${FEE_SHORTFALL_COPY.needs} ${creditsToDash(shortfall.missingCredits)} ${FEE_SHORTFALL_COPY.more}`
}
