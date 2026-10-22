import {IdentityPublicKeyInCreationWASM, IdentityUpdateTransitionWASM, PrivateKeyWASM} from 'dash-platform-sdk/types.js'
import {PlatformOperations} from '../../types/messages'
import {OperationContext, OperationError} from '../types'
import {broadcast} from '../broadcast'
import {identityCreateKeysFee} from '../fee'
import {IDENTITY_KEY_LOOKAHEAD} from '../../constants'
import {contractBoundsWASM} from './contractBounds'
import {applySignature, signingKey} from './signingKey'

type Payload = PlatformOperations['identityCreateKeys']['payload']
type Result = PlatformOperations['identityCreateKeys']['result']

export async function identityCreateKeys(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {sdk, network} = ctx
  const {seed, identifier, identityIndex, keys} = payload

  const identity = await sdk.identities.getIdentityByIdentifier(identifier)
  if (BigInt(identity.balance) < identityCreateKeysFee(keys, identity.getPublicKeys()).feeCredits) {
    throw new OperationError('The identity cannot afford to create these keys', 'insufficientFunds')
  }
  const firstKeyId = Math.max(...identity.getPublicKeys().map(key => key.keyId)) + 1
  // The key id doubles as the derivation index, and signingKey scans only this far.
  if (firstKeyId + keys.length > IDENTITY_KEY_LOOKAHEAD) {
    throw new OperationError('This identity has no key slots left that this wallet can sign with', 'internal')
  }

  const master = await signingKey(sdk, seed, network, identifier, identityIndex, 'AUTHENTICATION', 'MASTER')
  const hdKey = sdk.keyPair.seedToHdKey(seed, network)
  const added = keys.map((key, i) => {
    const keyId = firstKeyId + i
    const child = sdk.keyPair.deriveIdentityPrivateKey(hdKey, identityIndex, keyId, network)
    if (child.privateKey == null || child.publicKey == null) {
      throw new OperationError(`Could not derive identity key ${keyId}`, 'internal')
    }
    return {keyId, key, privateKey: PrivateKeyWASM.fromBytes(child.privateKey, network), publicKey: child.publicKey}
  })
  const inCreation = (signable?: Uint8Array) => added.map(({keyId, key, privateKey, publicKey}) => new IdentityPublicKeyInCreationWASM(
    keyId, key.purpose, key.securityLevel, 'ECDSA_SECP256K1', false, publicKey, signable == null ? undefined : privateKey.sign(signable), contractBoundsWASM(key.contractBounds)))

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
