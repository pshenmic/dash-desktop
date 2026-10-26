import {IdentityUpdateTransitionWASM} from 'dash-platform-sdk/types.js'
import {PlatformOperations} from '../../types/messages'
import {OperationContext, OperationError} from '../types'
import {broadcast} from '../broadcast'
import {identityDisableKeysFee} from '../fee'
import {applySignature, signingKey} from './signingKey'

type Payload = PlatformOperations['identityDisableKeys']['payload']
type Result = PlatformOperations['identityDisableKeys']['result']

// Drive charges a nonce bump for a key id it cannot find or a MASTER key disabled
// alone, and quietly accepts one already disabled, so all three are refused here.
export async function identityDisableKeys(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {sdk, network} = ctx
  const {seed, identifier, identityIndex, keyIds} = payload

  const identity = await sdk.identities.getIdentityByIdentifier(identifier)
  if (BigInt(identity.balance) < identityDisableKeysFee(keyIds.length).feeCredits) {
    throw new OperationError('The identity cannot afford to disable these keys', 'insufficientFunds')
  }
  for (const keyId of keyIds) {
    const key = identity.getPublicKeys().find(candidate => candidate.keyId === keyId)
    if (key == null) throw new OperationError(`This identity has no key ${keyId}`, 'internal')
    if (key.disabledAt != null) throw new OperationError(`Key ${keyId} is already disabled`, 'internal')
    if (key.securityLevel === 'MASTER') throw new OperationError(`Key ${keyId} is the MASTER key, which cannot be disabled`, 'internal')
  }

  const master = await signingKey(sdk, seed, network, identifier, identityIndex, 'AUTHENTICATION', 'MASTER')
  ctx.progress('signing', 0, 0)
  const identityNonce = await sdk.identities.getIdentityNonce(identifier) + 1n
  const st = new IdentityUpdateTransitionWASM(identifier, identity.revision + 1n, identityNonce, [], keyIds).toStateTransition()
  applySignature(st, master.privateKey, master.publicKey)

  return {stHash: await broadcast(sdk, st, ctx)}
}
