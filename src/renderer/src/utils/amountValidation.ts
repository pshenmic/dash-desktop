import { AmountValidationParams } from '../api/types'
import { TransferOperation } from '../enums/TransferOperation'
import { MAX_SPEND_NOTES } from '../constants/shielded'
import { SHIELDED_BALANCE_UNKNOWN_ERROR } from '../constants/sendPages'
import { formatCredits } from './balance'
import { isPoolIdentityDenomination } from './transferMatrix'

export function amountErrorFor(params: AmountValidationParams): string | null {
  const { isDashUnit, amount, operation, amountCredits, minCredits, availableCredits, feeCredits, maxPerTx } = params

  if (isDashUnit || amount.length === 0) return null

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
