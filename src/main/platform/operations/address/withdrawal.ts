import {AddressCreditWithdrawalTransitionWASM} from 'dash-platform-sdk/types.js'
import {coreAddressToScript} from '../../../src/utils/coreScript'
import {PlatformOperations} from '../../types/messages'
import {OperationContext} from '../types'
import {broadcast} from '../broadcast'
import {signInputs, toFeeStrategy, toInputAddresses} from './signInputs'

type Payload = PlatformOperations['addressWithdrawal']['payload']
type Result = PlatformOperations['addressWithdrawal']['result']

export async function addressWithdrawal(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {sdk, network} = ctx
  const {seed, inputs, coreAddress, coreFeePerByte} = payload

  ctx.progress('signing', 0, 0)
  const unsigned = sdk.platformAddresses.createStateTransition('addressCreditWithdrawal', {
    inputs: toInputAddresses(inputs),
    feeStrategy: toFeeStrategy(payload.feeStrategy),
    inputWitness: [],
    userFeeIncrease: 0,
    coreFeePerByte,
    pooling: 'Never',
    outputScript: coreAddressToScript(coreAddress, network),
  })

  const transition = AddressCreditWithdrawalTransitionWASM.fromStateTransition(unsigned)
  transition.inputWitness = await signInputs(sdk, unsigned.getSignableBytes(), inputs, seed, network)

  return {stHash: await broadcast(sdk, transition.toStateTransition(), ctx)}
}
