import {AssetLockProofWASM} from 'dash-platform-sdk/types.js'
import {OrchardAddressWASM, OutPointWASM, PrivateKeyWASM, ShieldedMemoWASM} from 'pshenmic-dpp'
import {AssetLockProofParams, PlatformOperations} from '../../types/messages'
import {OperationContext, OperationError} from '../types'
import {broadcast} from '../broadcast'
import {SHIELD_FUNDING_DUMMY_OUTPUTS} from './constants'
import {SHIELDED_ACCOUNT} from '../../../src/constants'

type Payload = PlatformOperations['shieldFromAssetLock']['payload']
type Result = PlatformOperations['shieldFromAssetLock']['result']

function assetLockProof(params: AssetLockProofParams, txid: string, outputIndex: number): AssetLockProofWASM {
  return params.type === 'instantLock'
    ? AssetLockProofWASM.createInstantAssetLockProof(
        Uint8Array.from(Buffer.from(params.instantLock, 'hex')),
        Uint8Array.from(Buffer.from(params.transaction, 'hex')),
        outputIndex,
      )
    : AssetLockProofWASM.createChainAssetLockProof(
        params.coreChainLockedHeight,
        new OutPointWASM(txid, outputIndex),
      )
}

export async function shieldFromAssetLock(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {sdk, network} = ctx
  const {seed} = payload

  const hdKey = sdk.keyPair.seedToHdKey(seed, network)
  const derived = await sdk.keyPair.derivePath(hdKey, payload.creditDerivationPath)
  if (!derived.privateKey) throw new OperationError('Failed to derive the asset lock credit key', 'internal')

  const privateKey = PrivateKeyWASM.fromBytes(derived.privateKey as Uint8Array, network)
  const senderOvk = sdk.keyPair.deriveShieldedOutgoingViewingKey(seed, network, SHIELDED_ACCOUNT)

  ctx.progress('proving', 0, 0)
  const stateTransition = await sdk.shielded.createStateTransition('shieldFromAssetLock', {
    recipient: OrchardAddressWASM.fromBech32m(payload.recipient),
    shieldAmount: payload.shieldAmountCredits,
    assetLockProof: assetLockProof(payload.assetLockProof, payload.txid, payload.outputIndex),
    privateKey,
    memo: ShieldedMemoWASM.empty() as unknown as string,
    dummyOutputs: SHIELD_FUNDING_DUMMY_OUTPUTS,
    senderOvk,
    ...(payload.surplusAddress != null ? {surplusOutput: payload.surplusAddress} : {}),
  })

  return {stHash: await broadcast(sdk, stateTransition, ctx)}
}