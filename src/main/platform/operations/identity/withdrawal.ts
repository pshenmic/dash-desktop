import {PlatformOperations} from '../../types/messages'
import {OperationContext} from '../types'
import {broadcast} from '../broadcast'
import {unsignedTransition} from '../unsignedTransition'
import {applySignature, signingKey} from './signingKey'

type Payload = PlatformOperations['identityWithdrawal']['payload']
type Result = PlatformOperations['identityWithdrawal']['result']

export async function identityWithdrawal(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {sdk, network} = ctx
  const {seed, identifier, identityIndex, amountCredits, coreAddress} = payload

  const {privateKey, publicKey} = await signingKey(sdk, seed, network, identifier, identityIndex)
  const identityNonce = await sdk.identities.getIdentityNonce(identifier) + 1n

  ctx.progress('signing', 0, 0)
  const st = unsignedTransition({
    kind: 'identityWithdrawal',
    identifier,
    nonce: identityNonce,
    amountCredits,
    coreAddress,
    coreFeePerByte: payload.coreFeePerByte,
  }, ctx)
  applySignature(st, privateKey, publicKey)

  return {stHash: await broadcast(sdk, st, ctx)}
}
