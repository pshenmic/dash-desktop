import type { OperationFeeParams } from '../api/types'
import { TransferOperation } from '../enums/TransferOperation'
import { coreSpendSourceKey, platformSpendSourceKey } from './coinControl'

export function operationFeeRequest(walletId: string | null, operation: TransferOperation | null, params: OperationFeeParams) {
  if (walletId == null || operation == null) return null
  if (operation !== TransferOperation.CoreSend && !params.destinationValid) return null

  const { destinationValid: _, ...feeParams } = params
  const { recipient, coreSource, platformSource, identityId, shieldedSource, amountCredits, amountDuffs } = params
  const recipientKey = operation === TransferOperation.CoreSend
    ? `outputs:${Array.isArray(recipient) ? Math.max(recipient.length, 1) : 1}`
    : JSON.stringify(recipient)
  const noteKey = shieldedSource == null ? '' : `${shieldedSource.kind}:${shieldedSource.noteIndexes.join(',')}`
  const maxKey = `${walletId}:${operation}:${recipientKey}:${coreSpendSourceKey(coreSource)}:${platformSpendSourceKey(platformSource)}:${identityId}:${noteKey}`
  return { walletId, operation, feeParams, maxKey, key: `${maxKey}:${amountCredits}:${amountDuffs}` }
}
