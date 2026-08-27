import { AssetLockFundingPhase } from '../enums/AssetLockFundingPhase'
import { IDENTITY_REGISTRATION_MIN_DUFFS } from '../constants'
import { davToDash } from './balance'

export function identityRegistrationMaxDuffs(balanceDuffs: bigint, totalFeeDuffs: bigint): bigint {
  return balanceDuffs > totalFeeDuffs ? balanceDuffs - totalFeeDuffs : 0n
}

export function identityRegistrationAmountError(
  amount: string,
  amountDuffs: bigint,
  balanceDuffs: bigint,
  totalFeeDuffs: bigint,
): string | null {
  if (amount.length === 0) return null
  if (!/^(?:\d+(?:\.\d{0,8})?|\.\d{1,8})$/.test(amount)) return 'Enter a valid Dash amount with up to 8 decimal places.'
  if (amountDuffs < IDENTITY_REGISTRATION_MIN_DUFFS) {
    return `Minimum identity funding is ${davToDash(IDENTITY_REGISTRATION_MIN_DUFFS)} Dash.`
  }

  const maxDuffs = identityRegistrationMaxDuffs(balanceDuffs, totalFeeDuffs)
  if (amountDuffs > maxDuffs) {
    return `Max available is ${davToDash(maxDuffs)} Dash after fees.`
  }

  return null
}

export function isUnfinishedAssetLockFunding(phase: AssetLockFundingPhase): boolean {
  return phase === AssetLockFundingPhase.Resumable
    || phase === AssetLockFundingPhase.Building
    || phase === AssetLockFundingPhase.BroadcastingL1
    || phase === AssetLockFundingPhase.WaitingChainLock
    || phase === AssetLockFundingPhase.BroadcastingST
}
