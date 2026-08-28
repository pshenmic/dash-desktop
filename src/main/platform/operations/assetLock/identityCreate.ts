import {KeyType, PrivateKeyWASM} from 'dash-platform-sdk/types.js'
import {PlatformOperations} from '../../types/messages'
import {OperationContext, OperationError} from '../types'
import {broadcast} from '../broadcast'
import {assetLockProofParams} from '../assetLockProof'
import {IDENTITY_KEY_DEFINITIONS} from '../../../src/constants/credits'

type Payload = PlatformOperations['identityCreateFromAssetLock']['payload']
type Result = PlatformOperations['identityCreateFromAssetLock']['result']

export async function identityCreateFromAssetLock(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {sdk, network} = ctx
  const {seed, identityIndex, txid, outputIndex} = payload

  const hdKey = sdk.keyPair.seedToHdKey(seed, network)
  const derived = await sdk.keyPair.derivePath(hdKey, payload.creditDerivationPath)
  if (!derived.privateKey) throw new OperationError('Failed to derive the identity registration key', 'internal')
  const registrationKey = PrivateKeyWASM.fromBytes(derived.privateKey as Uint8Array, network)

  const identityKeys = IDENTITY_KEY_DEFINITIONS.map(({id}) => {
    const child = sdk.keyPair.deriveIdentityPrivateKey(hdKey, identityIndex, id, network)
    if (child.privateKey == null) throw new OperationError(`Could not derive identity key ${id}`, 'internal')
    return PrivateKeyWASM.fromBytes(child.privateKey, network)
  })

  const assetLockProof = assetLockProofParams(payload.assetLockProof, txid, outputIndex)
  const publicKeys = IDENTITY_KEY_DEFINITIONS.map(({id, purpose, securityLevel, keyType}, i) => ({
    id,
    purpose,
    securityLevel,
    keyType,
    readOnly: false,
    data: Uint8Array.from(identityKeys[i].getPublicKey().bytes()),
    signature: undefined as Uint8Array | undefined,
  }))

  ctx.progress('signing', 0, 0)
  // Each signByPrivateKey overwrites the same WASM signature slot, so the
  // proof-of-possession is copied out before the next key signs.
  let stateTransition = sdk.identities.createStateTransition('create', {publicKeys, assetLockProof})
  for (let i = 0; i < identityKeys.length; i++) {
    stateTransition.signByPrivateKey(identityKeys[i], undefined, IDENTITY_KEY_DEFINITIONS[i].keyType)
    if (stateTransition.signature == null) {
      throw new OperationError(`signByPrivateKey did not produce a signature for identity key ${i}`, 'internal')
    }
    publicKeys[i].signature = Uint8Array.from(stateTransition.signature)
  }

  stateTransition = sdk.identities.createStateTransition('create', {publicKeys, assetLockProof})
  stateTransition.signByPrivateKey(registrationKey, undefined, KeyType.ECDSA_SECP256K1)

  const identifier = stateTransition.getOwnerId()?.base58()
  if (identifier == null || identifier === '') {
    throw new OperationError('Could not derive identity identifier from state transition', 'internal')
  }

  return {stHash: await broadcast(sdk, stateTransition, ctx, {idempotent: true}), identifier}
}