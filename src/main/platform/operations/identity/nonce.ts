import {PlatformOperations} from '../../types/messages'
import {OperationContext} from '../types'

type Payload = PlatformOperations['identityNonce']['payload']
type Result = PlatformOperations['identityNonce']['result']

export async function identityNonce(payload: Payload, ctx: OperationContext): Promise<Result> {
  const nonce = await ctx.sdk.identities.getIdentityNonce(payload.identifier)
  return {nonce}
}