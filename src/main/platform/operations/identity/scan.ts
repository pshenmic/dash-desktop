import {PrivateKeyWASM} from 'dash-platform-sdk/types.js'
import {PlatformOperations} from '../../types/messages'
import {OperationContext, OperationError, throwIfAborted} from '../types'

type Payload = PlatformOperations['identityScan']['payload']
type Result = PlatformOperations['identityScan']['result']

// Walks identity indexes off the seed and asks Platform which are taken.
// Registration needs the first free index; wallet restore needs every taken one,
// which is the same walk with a wider gap.
export async function identityScan(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {sdk, network} = ctx
  const {seed, startIndex, gapLimit, scanLimit} = payload

  const hdKey = sdk.keyPair.seedToHdKey(seed, network)
  const identities: Array<{index: number; identifier: string}> = []
  let nextFreeIndex: number | null = null
  let gap = 0

  for (let scanned = 0; scanned < scanLimit && gap < gapLimit; scanned++) {
    throwIfAborted(ctx.signal)

    const index = startIndex + scanned
    const derived = sdk.keyPair.deriveIdentityPrivateKey(hdKey, index, 0, network)
    if (derived.privateKey == null) {
      throw new OperationError(`Could not derive identity key at index ${index}`, 'internal')
    }
    const pkh = PrivateKeyWASM.fromBytes(derived.privateKey, network).getPublicKeyHash()

    const existing =
      await sdk.identities.getIdentityByPublicKeyHash(pkh).catch(() => null) ??
      await sdk.identities.getIdentityByNonUniquePublicKeyHash(pkh).catch(() => null)

    if (existing == null) {
      nextFreeIndex ??= index
      gap++
    } else {
      identities.push({index, identifier: existing.id.base58()})
      gap = 0
    }
  }

  if (nextFreeIndex == null) {
    throw new OperationError(`Could not find a free identity index within ${scanLimit} attempts`, 'internal')
  }

  return {identities, nextFreeIndex}
}