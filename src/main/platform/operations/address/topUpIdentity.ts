import {IdentityTopUpFromAddressesTransitionWASM} from 'dash-platform-sdk/types.js'
import {PlatformOperations} from '../../types/messages'
import {OperationContext} from '../types'
import {broadcast} from '../broadcast'
import {unsignedTransition} from '../unsignedTransition'
import {signInputs} from './signInputs'

type Payload = PlatformOperations['identityTopUpFromAddresses']['payload']
type Result = PlatformOperations['identityTopUpFromAddresses']['result']

export async function identityTopUpFromAddresses(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {sdk, network} = ctx
  const {seed, identifier, inputs} = payload

  ctx.progress('signing', 0, 0)
  const unsigned = unsignedTransition(
    {kind: 'identityTopUpFromAddresses', identifier, inputs, feeStrategy: payload.feeStrategy}, ctx)

  const transition = IdentityTopUpFromAddressesTransitionWASM.fromStateTransition(unsigned)
  transition.inputWitness = await signInputs(sdk, unsigned.getSignableBytes(), inputs, seed, network)

  return {stHash: await broadcast(sdk, transition.toStateTransition(), ctx)}
}
