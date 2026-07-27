import {OutputAddressWASM} from 'dash-platform-sdk/types.js'
import {PlatformOperations} from '../../types/messages'
import {OperationContext} from '../types'
import {broadcast} from '../broadcast'
import {applySignature, signingKey} from './signingKey'

type Payload = PlatformOperations['identityCreditsToAddresses']['payload']
type Result = PlatformOperations['identityCreditsToAddresses']['result']

export async function identityCreditsToAddresses(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {sdk, network} = ctx
  const {seed, identifier, identityIndex, recipients} = payload

  const {privateKey, publicKey} = await signingKey(sdk, seed, network, identifier, identityIndex)
  const nonce = await sdk.identities.getIdentityNonce(identifier) + 1n

  ctx.progress('signing', 0, 0)
  const st = sdk.platformAddresses.createStateTransition('identityCreditTransferToAddresses', {
    identityId: identifier,
    recipients: recipients.map(recipient => new OutputAddressWASM(recipient.address, recipient.amountCredits)),
    nonce,
    userFeeIncrease: 0,
  })
  applySignature(st, privateKey, publicKey)

  return {stHash: await broadcast(sdk, st, ctx)}
}
