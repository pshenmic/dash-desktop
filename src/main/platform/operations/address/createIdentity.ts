import {IdentityCreateFromAddressesTransitionWASM, IdentityPublicKeyInCreationWASM, PrivateKeyWASM} from 'dash-platform-sdk/types.js'
import {PlatformOperations} from '../../types/messages'
import {OperationContext, OperationError} from '../types'
import {broadcast} from '../broadcast'
import {signInputs, toFeeStrategy, toInputAddresses} from './signInputs'
import {IDENTITY_KEY_DEFINITIONS} from '../../../src/constants/credits'
import {contractBoundsWASM} from '../identity/contractBounds'

type Payload = PlatformOperations['identityCreateFromAddresses']['payload']
type Result = PlatformOperations['identityCreateFromAddresses']['result']


export async function identityCreateFromAddresses(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {sdk, network} = ctx
  const {seed, identityIndex, inputs} = payload

  const hdKey = sdk.keyPair.seedToHdKey(seed, network)
  const keys = IDENTITY_KEY_DEFINITIONS.map(spec => {
    const child = sdk.keyPair.deriveIdentityPrivateKey(hdKey, identityIndex, spec.id, network)
    if (!child.privateKey || !child.publicKey) {
      throw new OperationError(`Failed to derive identity key at index ${spec.id}`, 'internal')
    }
    return {
      spec,
      privateKey: PrivateKeyWASM.fromBytes(child.privateKey as Uint8Array, network),
      publicKey: child.publicKey as Uint8Array,
    }
  })

  ctx.progress('signing', 0, 0)
  const unsigned = sdk.platformAddresses.createStateTransition('identityCreateFromAddresses', {
    publicKeys: keys.map(key =>
      new IdentityPublicKeyInCreationWASM(key.spec.id, key.spec.purpose, key.spec.securityLevel, key.spec.keyType, false, key.publicKey, undefined, contractBoundsWASM(key.spec.contractBounds))),
    inputs: toInputAddresses(inputs),
    feeStrategy: toFeeStrategy(payload.feeStrategy),
    inputWitness: [],
    userFeeIncrease: 0,
  })

  const signable = unsigned.getSignableBytes()
  const transition = IdentityCreateFromAddressesTransitionWASM.fromStateTransition(unsigned)
  // Each key signs a proof-of-possession over the same signable bytes.
  transition.publicKeys = keys.map(key =>
    new IdentityPublicKeyInCreationWASM(key.spec.id, key.spec.purpose, key.spec.securityLevel, key.spec.keyType, false, key.publicKey, key.privateKey.sign(signable), contractBoundsWASM(key.spec.contractBounds)))
  transition.inputWitness = await signInputs(sdk, signable, inputs, seed, network)

  const stHash = await broadcast(sdk, transition.toStateTransition(), ctx)

  // The id is derived from the master key, so it is only readable back off the
  // chain once the transition is in a block.
  const masterKeyHash = keys[0].privateKey.getPublicKeyHash()
  let identifier: string
  try {
    identifier = (await sdk.identities.getIdentityByPublicKeyHash(masterKeyHash)).id.base58()
  } catch {
    try {
      identifier = (await sdk.identities.getIdentityByNonUniquePublicKeyHash(masterKeyHash)).id.base58()
    } catch {
      throw new OperationError(
        'Identity was broadcast but could not be resolved yet — re-open the wallet to pick it up',
        'network',
        stHash,
      )
    }
  }

  return {stHash, identifier}
}
