import { AssetLockFundingPhase } from '../enums/AssetLockFundingPhase'
import { CORE_FEE_DUFFS, IDENTITY_REGISTRATION_MIN_DUFFS } from '../constants'
import { davToDash } from './balance'

export function identityRegistrationMaxDuffs(balanceDuffs: bigint): bigint {
  return balanceDuffs > CORE_FEE_DUFFS ? balanceDuffs - CORE_FEE_DUFFS : 0n
}

export function identityRegistrationAmountError(
  amount: string,
  amountDuffs: bigint,
  balanceDuffs: bigint,
): string | null {
  if (amount.length === 0) return null
  if (!/^(?:\d+(?:\.\d{0,8})?|\.\d{1,8})$/.test(amount)) return 'Enter a valid Dash amount with up to 8 decimal places.'
  if (amountDuffs < IDENTITY_REGISTRATION_MIN_DUFFS) {
    return `Minimum identity funding is ${davToDash(IDENTITY_REGISTRATION_MIN_DUFFS)} Dash.`
  }

  const maxDuffs = identityRegistrationMaxDuffs(balanceDuffs)
  if (amountDuffs > maxDuffs) {
    return `Max available is ${davToDash(maxDuffs)} Dash after the Core network fee.`
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
