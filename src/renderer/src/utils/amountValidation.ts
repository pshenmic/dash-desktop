import { AmountValidationParams } from '../api/types'
import { TransferOperation } from '../enums/TransferOperation'
import { SHIELDED_BALANCE_UNKNOWN_ERROR } from '../constants/sendPages'
import { creditsToDuffs, davToDash } from './balance'
import { isPoolIdentityDenomination } from './transferMatrix'

export function amountErrorFor(params: AmountValidationParams): string | null {
  const { isCoreOperation, amount, operation, amountDuffs, coreMaxDuffs, amountCredits, minCredits, availableCredits, feeCredits, maxPerTx, noteLimit } = params

  if (amount.length === 0) return null

  if (isCoreOperation) {
    if (amountDuffs <= 0n || coreMaxDuffs === null || amountDuffs <= coreMaxDuffs) return null
    return `Max sendable is ${davToDash(coreMaxDuffs)} Dash after fees.`
  }

  if (operation === TransferOperation.IdentityCreateFromShielded && !isPoolIdentityDenomination(amountCredits)) {
    return 'Pick one of the fixed denominations above.'
  }

  if (amountCredits < minCredits) return `Minimum is ${davToDash(creditsToDuffs(minCredits))} Dash.`

  if (availableCredits === null) return SHIELDED_BALANCE_UNKNOWN_ERROR

  if (feeCredits === null) return null

  if (amountCredits + feeCredits > availableCredits) {
    return `Amount plus the ${davToDash(creditsToDuffs(feeCredits))} Dash fee exceeds this balance.`
  }

  if (maxPerTx !== null && amountCredits > maxPerTx) {
    return `Max per transaction right now is ${davToDash(creditsToDuffs(maxPerTx))} Dash (network fee + ${noteLimit ?? 0}-note limit).`
  }

  return null
}
