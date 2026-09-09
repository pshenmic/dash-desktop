import {PlatformOperations} from '../../../types/messages'
import {OperationContext} from '../../types'
import {nullifierStatuses} from './nullifierStatuses'

type Payload = PlatformOperations['checkNullifiers']['payload']
type Result = PlatformOperations['checkNullifiers']['result']

// Matched by nullifier rather than array position: the response order is not
// contractual.
export async function checkNullifiers(payload: Payload, ctx: OperationContext): Promise<Result> {
  if (payload.nullifiers.length === 0) return {spent: []}

  const statuses = await nullifierStatuses(ctx.sdk, payload.nullifiers)
  return {spent: statuses.filter(status => status.isSpent).map(status => status.nullifier)}
}
