import {AddressFundsTransferTransitionWASM} from 'dash-platform-sdk/types.js'
import {PlatformOperations} from '../../types/messages'
import {OperationContext, OperationError} from '../types'
import {broadcast} from '../broadcast'
import {unsignedTransition} from '../unsignedTransition'
import {signInputs} from './signInputs'

type Payload = PlatformOperations['addressTransfer']['payload']
type Result = PlatformOperations['addressTransfer']['result']

export async function addressTransfer(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {sdk, network} = ctx
  const {seed, inputs, recipients} = payload

  // Consensus refuses an output address that is also an input.
  const paid = new Set(recipients.map(recipient => recipient.address))
  if (inputs.some(input => paid.has(input.platformAddress))) {
    throw new OperationError('A recipient cannot also be one of the addresses funding this transfer', 'internal')
  }

  ctx.progress('signing', 0, 0)
  const unsigned = unsignedTransition({kind: 'addressFundsTransfer', inputs, feeStrategy: payload.feeStrategy, recipients}, ctx)

  const transition = AddressFundsTransferTransitionWASM.fromStateTransition(unsigned)
  transition.inputWitness = await signInputs(sdk, unsigned.getSignableBytes(), inputs, seed, network)

  return {stHash: await broadcast(sdk, transition.toStateTransition(), ctx)}
}
