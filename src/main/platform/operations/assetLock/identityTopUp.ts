import {KeyType, PrivateKeyWASM} from 'dash-platform-sdk/types.js'
import {PlatformOperations} from '../../types/messages'
import {OperationContext, OperationError} from '../types'
import {broadcast} from '../broadcast'
import {assetLockProofParams} from '../assetLockProof'

type Payload = PlatformOperations['identityTopUpFromAssetLock']['payload']
type Result = PlatformOperations['identityTopUpFromAssetLock']['result']

// Signed only by the funding key that owns the asset lock credit output — no
// identity keys, so any identity can be topped up by its identifier.
export async function identityTopUpFromAssetLock(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {sdk, network} = ctx
  const {seed, txid, outputIndex} = payload

  const hdKey = sdk.keyPair.seedToHdKey(seed, network)
  const derived = await sdk.keyPair.derivePath(hdKey, payload.creditDerivationPath)
  if (!derived.privateKey) throw new OperationError('Failed to derive the asset lock funding key', 'internal')
  const fundingKey = PrivateKeyWASM.fromBytes(derived.privateKey as Uint8Array, network)

  ctx.progress('signing', 0, 0)
  const stateTransition = sdk.identities.createStateTransition('topUp', {
    identityId: payload.identifier,
    assetLockProof: assetLockProofParams(payload.assetLockProof, txid, outputIndex),
  })
  stateTransition.signByPrivateKey(fundingKey, undefined, KeyType.ECDSA_SECP256K1)

  return {stHash: await broadcast(sdk, stateTransition, ctx, {idempotent: true})}
}