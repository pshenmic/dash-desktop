import {AddressFundsTransferTransitionWASM, OutputAddressWASM} from 'dash-platform-sdk/types.js'
import {PlatformOperations} from '../../types/messages'
import {OperationContext, OperationError} from '../types'
import {broadcast} from '../broadcast'
import {DEDUCT_FROM_FIRST, signInputs, toInputAddresses} from './signInputs'

type Payload = PlatformOperations['addressTransfer']['payload']
type Result = PlatformOperations['addressTransfer']['result']

export async function addressTransfer(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {sdk, network} = ctx
  const {seed, input, recipient, amountCredits} = payload

  if (recipient === input.platformAddress) {
    throw new OperationError('Recipient must be different from the source address', 'internal')
  }

  ctx.progress('signing', 0, 0)
  const unsigned = sdk.platformAddresses.createStateTransition('addressFundsTransfer', {
    inputs: toInputAddresses([input]),
    feeStrategy: DEDUCT_FROM_FIRST,
    userFeeIncrease: 0,
    inputWitness: [],
    outputs: [new OutputAddressWASM(recipient, amountCredits)],
  })

  const transition = AddressFundsTransferTransitionWASM.fromStateTransition(unsigned)
  transition.inputWitness = await signInputs(sdk, unsigned.getSignableBytes(), [input], seed, network)

  return {stHash: await broadcast(sdk, transition.toStateTransition(), ctx)}
}
