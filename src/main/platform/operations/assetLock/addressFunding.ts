import {
  AddressFundingFromAssetLockTransitionWASM,
  AddressFundsFeeStrategyStepWASM,
  OutputAddressNullableCreditsWASM,
  PrivateKeyWASM,
} from 'dash-platform-sdk/types.js'
import {PlatformOperations} from '../../types/messages'
import {OperationContext, OperationError} from '../types'
import {broadcast} from '../broadcast'
import {buildAssetLockProof} from '../assetLockProof'

type Payload = PlatformOperations['addressFundingFromAssetLock']['payload']
type Result = PlatformOperations['addressFundingFromAssetLock']['result']

export async function addressFundingFromAssetLock(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {sdk, network} = ctx
  const {seed, txid, outputIndex} = payload

  const hdKey = sdk.keyPair.seedToHdKey(seed, network)
  const derived = await sdk.keyPair.derivePath(hdKey, payload.creditDerivationPath)
  if (!derived.privateKey) throw new OperationError('Failed to derive the asset lock credit key', 'internal')
  const creditKey = PrivateKeyWASM.fromBytes(derived.privateKey as Uint8Array, network)

  ctx.progress('signing', 0, 0)
  const unsigned = sdk.platformAddresses.createStateTransition('addressFundingFromAssetLock', {
    assetLockProof: buildAssetLockProof(payload.assetLockProof, txid, outputIndex),
    inputs: [],
    feeStrategy: [AddressFundsFeeStrategyStepWASM.ReduceOutput(0)],
    inputWitness: [],
    outputs: [new OutputAddressNullableCreditsWASM(payload.recipient)],
    userFeeIncrease: 0,
  })

  const transition = AddressFundingFromAssetLockTransitionWASM.fromStateTransition(unsigned)
  transition.signature = creditKey.sign(unsigned.getSignableBytes())

  return {stHash: await broadcast(sdk, transition.toStateTransition(), ctx, {idempotent: true})}
}