import {PlatformOperations} from '../../types/messages'
import {OperationContext} from '../types'

type Payload = PlatformOperations['identityExists']['payload']
type Result = PlatformOperations['identityExists']['result']

export async function identityExists(payload: Payload, ctx: OperationContext): Promise<Result> {
  try {
    await ctx.sdk.identities.getIdentityByIdentifier(payload.identifier)
    return {exists: true}
  } catch {
    return {exists: false}
  }
}
