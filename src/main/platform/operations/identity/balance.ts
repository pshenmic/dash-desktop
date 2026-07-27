import {PlatformOperations} from '../../types/messages'
import {OperationContext} from '../types'

type Payload = PlatformOperations['identityBalance']['payload']
type Result = PlatformOperations['identityBalance']['result']

export async function identityBalance(payload: Payload, ctx: OperationContext): Promise<Result> {
  const credits = await ctx.sdk.identities.getIdentityBalance(payload.identifier)
  return {credits}
}