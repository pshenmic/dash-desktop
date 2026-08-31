import {OrchardAddressWASM, PrivateKeyWASM, ShieldedMemoWASM} from 'pshenmic-dpp'
import {PlatformOperations} from '../../types/messages'
import {OperationContext, OperationError} from '../types'
import {broadcast} from '../broadcast'
import {buildAssetLockProof} from '../assetLockProof'
import {SHIELD_FUNDING_DUMMY_OUTPUTS} from '../shielded/constants'
import {SHIELDED_ACCOUNT} from '../../../src/constants/addresses'

type Payload = PlatformOperations['shieldFromAssetLock']['payload']
type Result = PlatformOperations['shieldFromAssetLock']['result']

export async function shieldFromAssetLock(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {sdk, network} = ctx
  const {seed, txid, outputIndex} = payload

  const hdKey = sdk.keyPair.seedToHdKey(seed, network)
  const derived = await sdk.keyPair.derivePath(hdKey, payload.creditDerivationPath)
  if (!derived.privateKey) throw new OperationError('Failed to derive the asset lock credit key', 'internal')

  const privateKey = PrivateKeyWASM.fromBytes(derived.privateKey as Uint8Array, network)
  const senderOvk = sdk.keyPair.deriveShieldedOutgoingViewingKey(seed, network, SHIELDED_ACCOUNT)

  ctx.progress('proving', 0, 0)
  const stateTransition = await sdk.shielded.createStateTransition('shieldFromAssetLock', {
    recipient: OrchardAddressWASM.fromBech32m(payload.recipient),
    shieldAmount: payload.shieldAmountCredits,
    assetLockProof: buildAssetLockProof(payload.assetLockProof, txid, outputIndex),
    privateKey,
    memo: ShieldedMemoWASM.empty() as unknown as string,
    dummyOutputs: SHIELD_FUNDING_DUMMY_OUTPUTS,
    senderOvk,
    ...(payload.surplusAddress != null ? {surplusOutput: payload.surplusAddress} : {}),
  })

  return {stHash: await broadcast(sdk, stateTransition, ctx, {idempotent: true})}
}