import {AddressCreditWithdrawalTransitionWASM} from 'dash-platform-sdk/types.js'
import {PlatformOperations} from '../../types/messages'
import {OperationContext} from '../types'
import {broadcast} from '../broadcast'
import {unsignedTransition} from '../unsignedTransition'
import {signInputs} from './signInputs'

type Payload = PlatformOperations['addressWithdrawal']['payload']
type Result = PlatformOperations['addressWithdrawal']['result']

export async function addressWithdrawal(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {sdk, network} = ctx
  const {seed, inputs, coreAddress, coreFeePerByte} = payload

  ctx.progress('signing', 0, 0)
  const unsigned = unsignedTransition(
    {kind: 'addressWithdrawal', inputs, feeStrategy: payload.feeStrategy, coreAddress, coreFeePerByte}, ctx)

  const transition = AddressCreditWithdrawalTransitionWASM.fromStateTransition(unsigned)
  transition.inputWitness = await signInputs(sdk, unsigned.getSignableBytes(), inputs, seed, network)

  return {stHash: await broadcast(sdk, transition.toStateTransition(), ctx)}
}
