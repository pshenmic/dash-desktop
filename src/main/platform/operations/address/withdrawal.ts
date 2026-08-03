import {AddressCreditWithdrawalTransitionWASM} from 'dash-platform-sdk/types.js'
import {coreAddressToScript} from '../../../src/utils/coreScript'
import {PlatformOperations} from '../../types/messages'
import {OperationContext} from '../types'
import {broadcast} from '../broadcast'
import {DEDUCT_FROM_FIRST, signInputs, toInputAddresses} from './signInputs'
import {CORE_FEE_PER_BYTE} from '../../../src/constants'

type Payload = PlatformOperations['addressWithdrawal']['payload']
type Result = PlatformOperations['addressWithdrawal']['result']

export async function addressWithdrawal(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {sdk, network} = ctx
  const {seed, inputs, coreAddress} = payload

  ctx.progress('signing', 0, 0)
  const unsigned = sdk.platformAddresses.createStateTransition('addressCreditWithdrawal', {
    inputs: toInputAddresses(inputs),
    feeStrategy: DEDUCT_FROM_FIRST,
    inputWitness: [],
    userFeeIncrease: 0,
    coreFeePerByte: CORE_FEE_PER_BYTE,
    pooling: 'Never',
    outputScript: coreAddressToScript(coreAddress, network),
  })

  const transition = AddressCreditWithdrawalTransitionWASM.fromStateTransition(unsigned)
  transition.inputWitness = await signInputs(sdk, unsigned.getSignableBytes(), inputs, seed, network)

  return {stHash: await broadcast(sdk, transition.toStateTransition(), ctx)}
}
