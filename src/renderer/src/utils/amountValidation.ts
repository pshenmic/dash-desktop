import { AmountValidationParams } from '../api/types'
import { TransferOperation } from '../enums/TransferOperation'
import { SHIELDED_BALANCE_UNKNOWN_ERROR } from '../constants/sendPages'
import { creditsToDuffs, davToDash } from './balance'
import { isPoolIdentityDenomination, takesPlatformFeeFromLock } from './transferMatrix'

export function amountErrorFor(params: AmountValidationParams): string | null {
  const { isCoreOperation, amount, operation, amountDuffs, coreMaxDuffs, amountCredits, minCredits, availableCredits, feeCredits, maxPerTx, noteLimit } = params

  if (amount.length === 0) return null

  if (isCoreOperation) {
    if (amountDuffs <= 0n) return null
    if (coreMaxDuffs !== null && amountDuffs > coreMaxDuffs) return `Max sendable is ${davToDash(coreMaxDuffs)} Dash after fees.`
    if (feeCredits !== null && operation !== null && takesPlatformFeeFromLock(operation) && amountCredits <= feeCredits) {
      return `Amount must exceed the ${davToDash(creditsToDuffs(feeCredits))} Dash Platform fee taken out of it.`
    }
    return null
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
    const reason = noteLimit === null ? 'network fee reserve' : `network fee + ${noteLimit}-note limit`
    return `Max per transaction right now is ${davToDash(creditsToDuffs(maxPerTx))} Dash (${reason}).`
  }

  return null
}
