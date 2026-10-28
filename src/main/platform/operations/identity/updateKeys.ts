import {IdentityPublicKeyInCreationWASM, IdentityUpdateTransitionWASM, PrivateKeyWASM} from 'dash-platform-sdk/types.js'
import {PlatformOperations} from '../../types/messages'
import {OperationContext, OperationError} from '../types'
import {broadcast} from '../broadcast'
import {identityUpdateKeysFee} from '../fee'
import {identityKeysUpdateError} from '../../../src/utils/identityKeys'
import {contractBoundsWASM} from './contractBounds'
import {applySignature, signingKey} from './signingKey'

type Payload = PlatformOperations['identityUpdateKeys']['payload']
type Result = PlatformOperations['identityUpdateKeys']['result']

// Signed by the current MASTER key, which Drive checks against the keys as they
// were before the update, so it can sign its own replacement.
export async function identityUpdateKeys(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {sdk, network} = ctx
  const {seed, identifier, identityIndex, add, disable} = payload

  const identity = await sdk.identities.getIdentityByIdentifier(identifier)
  const existing = identity.getPublicKeys()
  const refusal = identityKeysUpdateError({add, disable}, existing.map(key => ({
    keyId: key.keyId, securityLevel: key.securityLevel, disabled: key.disabledAt != null,
  })))
  if (refusal != null) throw new OperationError(refusal, 'internal')

  if (BigInt(identity.balance) < identityUpdateKeysFee({add, disable}, existing).feeCredits) {
    throw new OperationError('The identity cannot afford this key update', 'insufficientFunds')
  }

  // The key id doubles as the derivation index; signingKey relies on it.
  const firstKeyId = Math.max(...existing.map(key => key.keyId)) + 1

  const master = await signingKey(sdk, seed, network, identifier, identityIndex, 'AUTHENTICATION', 'MASTER')
  const hdKey = sdk.keyPair.seedToHdKey(seed, network)
  const added = add.map((key, i) => {
    const keyId = firstKeyId + i
    const child = sdk.keyPair.deriveIdentityPrivateKey(hdKey, identityIndex, keyId, network)
    if (child.privateKey == null || child.publicKey == null) {
      throw new OperationError(`Could not derive identity key ${keyId}`, 'internal')
    }
    return {keyId, key, privateKey: PrivateKeyWASM.fromBytes(child.privateKey, network), publicKey: child.publicKey}
  })

  const inCreation = (signable?: Uint8Array): IdentityPublicKeyInCreationWASM[] => added.map(({keyId, key, privateKey, publicKey}) =>
    new IdentityPublicKeyInCreationWASM(keyId, key.purpose, key.securityLevel, 'ECDSA_SECP256K1', false, publicKey,
      signable == null ? undefined : privateKey.sign(signable), contractBoundsWASM(key.contractBounds)))

  ctx.progress('signing', 0, 0)
  const identityNonce = await sdk.identities.getIdentityNonce(identifier) + 1n
  const unsigned = new IdentityUpdateTransitionWASM(identifier, identity.revision + 1n, identityNonce, inCreation(), disable).toStateTransition()
  const transition = IdentityUpdateTransitionWASM.fromStateTransition(unsigned)

  // Each new key signs a proof-of-possession over the same signable bytes.
  transition.publicKeyIdsToAdd = inCreation(unsigned.getSignableBytes())
  const st = transition.toStateTransition()
  applySignature(st, master.privateKey, master.publicKey)

  return {stHash: await broadcast(sdk, st, ctx)}
}
