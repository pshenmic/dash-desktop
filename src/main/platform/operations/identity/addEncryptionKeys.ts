import {IdentityPublicKeyInCreationWASM, IdentityPublicKeyWASM, IdentityUpdateTransitionWASM, PrivateKeyWASM, Purpose} from 'dash-platform-sdk/types.js'
import {PlatformOperations} from '../../types/messages'
import {OperationContext, OperationError} from '../types'
import {broadcast} from '../broadcast'
import {IDENTITY_KEY_DEFINITIONS} from '../../../src/constants/credits'
import {applySignature, signingKey} from './signingKey'

type Payload = PlatformOperations['identityAddEncryptionKeys']['payload']
type Result = PlatformOperations['identityAddEncryptionKeys']['result']

// DashPay contact requests are encrypted between these keys, which identities
// created from addresses used to be registered without.
export async function identityAddEncryptionKeys(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {sdk, network} = ctx
  const {seed, identifier, identityIndex} = payload

  const identity = await sdk.identities.getIdentityByIdentifier(identifier)
  const keys = identity.getPublicKeys()
  const missing = missingEncryptionKeys(keys)
  if (missing.length === 0) return {stHash: null}

  const master = await signingKey(sdk, seed, network, identifier, identityIndex, 'AUTHENTICATION', 'MASTER')
  const hdKey = sdk.keyPair.seedToHdKey(seed, network)
  const firstKeyId = Math.max(...keys.map(key => key.keyId)) + 1
  // The key id doubles as the derivation index, which signingKey scans for.
  const added = missing.map((spec, i) => {
    const keyId = firstKeyId + i
    const child = sdk.keyPair.deriveIdentityPrivateKey(hdKey, identityIndex, keyId, network)
    if (child.privateKey == null || child.publicKey == null) {
      throw new OperationError(`Could not derive identity key ${keyId}`, 'internal')
    }
    return {keyId, spec, privateKey: PrivateKeyWASM.fromBytes(child.privateKey, network), publicKey: child.publicKey}
  })
  const inCreation = (signable?: Uint8Array) => added.map(({keyId, spec, privateKey, publicKey}) =>
    new IdentityPublicKeyInCreationWASM(keyId, spec.purpose, spec.securityLevel, spec.keyType, false, publicKey, signable && privateKey.sign(signable)))

  ctx.progress('signing', 0, 0)
  const identityNonce = await sdk.identities.getIdentityNonce(identifier) + 1n
  const unsigned = new IdentityUpdateTransitionWASM(identifier, identity.revision + 1n, identityNonce, inCreation(), []).toStateTransition()
  const transition = IdentityUpdateTransitionWASM.fromStateTransition(unsigned)
  // Each new key signs a proof-of-possession over the same signable bytes.
  transition.publicKeyIdsToAdd = inCreation(unsigned.getSignableBytes())
  const st = transition.toStateTransition()
  applySignature(st, master.privateKey, master.publicKey)

  return {stHash: await broadcast(sdk, st, ctx)}
}

export function missingEncryptionKeys(keys: IdentityPublicKeyWASM[]): typeof IDENTITY_KEY_DEFINITIONS[number][] {
  return IDENTITY_KEY_DEFINITIONS.filter(({purpose}) =>
    (purpose === Purpose.ENCRYPTION || purpose === Purpose.DECRYPTION) && !keys.some(key => key.purposeNumber === purpose))
}
