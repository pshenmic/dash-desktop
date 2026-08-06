import { AmountValidationParams } from '../api/types'
import { TransferOperation } from '../enums/TransferOperation'
import { MAX_SPEND_NOTES } from '../constants/shielded'
import { CORE_FEE_DUFFS, SHIELDED_BALANCE_UNKNOWN_ERROR } from '../constants/sendPages'
import { davToDash, formatCredits } from './balance'
import { isPoolIdentityDenomination } from './transferMatrix'

export function amountErrorFor(params: AmountValidationParams): string | null {
  const { isDashUnit, amount, operation, amountDuffs, balanceDuffs, amountCredits, minCredits, availableCredits, feeCredits, maxPerTx } = params

  if (amount.length === 0) return null

  if (isDashUnit) {
    if (amountDuffs <= 0n || amountDuffs + CORE_FEE_DUFFS <= balanceDuffs) return null
    const maxSendableDuffs = balanceDuffs > CORE_FEE_DUFFS ? balanceDuffs - CORE_FEE_DUFFS : 0n
    return `Max sendable is ${davToDash(maxSendableDuffs)} Dash after the network fee.`
  }

  if (operation === TransferOperation.IdentityCreateFromPool && !isPoolIdentityDenomination(amountCredits)) {
    return 'Pick one of the fixed denominations above.'
  }

  if (amountCredits < minCredits) return `Minimum is ${formatCredits(minCredits)} credits.`

  if (availableCredits === null) return SHIELDED_BALANCE_UNKNOWN_ERROR

  if (feeCredits === null) return null

  if (amountCredits + feeCredits > availableCredits) {
    return `Amount plus the ${formatCredits(feeCredits)} credit fee exceeds this balance.`
  }

  if (maxPerTx !== null && amountCredits > maxPerTx) {
    return `Max per transaction right now is ${formatCredits(maxPerTx)} credits (network fee + ${MAX_SPEND_NOTES}-note limit).`
  }

  return null
}
