import {coreAddressToScript} from '../../../src/utils/coreScript'
import {CORE_FEE_PER_BYTE} from '../../../src/utils/platformTransfer'
import {PlatformOperations} from '../../types/messages'
import {OperationContext} from '../types'
import {broadcast} from '../broadcast'
import {applySignature, signingKey} from './signingKey'

type Payload = PlatformOperations['identityWithdrawal']['payload']
type Result = PlatformOperations['identityWithdrawal']['result']

export async function identityWithdrawal(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {sdk, network} = ctx
  const {seed, identifier, identityIndex, amountCredits, coreAddress} = payload

  const {privateKey, publicKey} = await signingKey(sdk, seed, network, identifier, identityIndex)
  const identityNonce = await sdk.identities.getIdentityNonce(identifier) + 1n

  ctx.progress('signing', 0, 0)
  const st = sdk.identities.createStateTransition('withdrawal', {
    identityId: identifier,
    amount: amountCredits,
    coreFeePerByte: CORE_FEE_PER_BYTE,
    pooling: 'Never',
    identityNonce,
    outputScript: coreAddressToScript(coreAddress, network),
  })
  applySignature(st, privateKey, publicKey)

  return {stHash: await broadcast(sdk, st, ctx)}
}
