import {PrivateKeyWASM} from 'dash-platform-sdk/types.js'
import {PlatformOperations} from '../../types/messages'
import {OperationContext, OperationError, throwIfAborted} from '../types'
import {lookupIdentity} from '../identityLookup'

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

  const lookup = async (index: number): Promise<{index: number; identifier: string | null}> => {
    const derived = sdk.keyPair.deriveIdentityPrivateKey(hdKey, index, 0, network)

    if (derived.privateKey == null) {
      throw new OperationError(`Could not derive identity key at index ${index}`, 'internal')
    }

    const pkh = PrivateKeyWASM.fromBytes(derived.privateKey, network).getPublicKeyHash()

    const existing =
      await lookupIdentity(sdk.identities.getIdentityByPublicKeyHash(pkh), `index ${index}`) ??
      await lookupIdentity(sdk.identities.getIdentityByNonUniquePublicKeyHash(pkh), `index ${index}`)

    return {index, identifier: existing?.id.base58() ?? null}
  }

  // A gap's worth of indexes at a time: every lookup is a round trip, and a new
  // wallet walks at least one full gap.
  for (let scanned = 0; scanned < scanLimit && gap < gapLimit; scanned += gapLimit) {
    throwIfAborted(ctx.signal)
    const count = Math.min(gapLimit, scanLimit - scanned)
    const batch = await Promise.all(Array.from({length: count}, (_, i) => lookup(startIndex + scanned + i)))

    for (const {index, identifier} of batch) {
      if (gap >= gapLimit) break

      if (identifier == null) {
        nextFreeIndex ??= index
        gap++
      } else {
        identities.push({index, identifier})
        gap = 0
      }
    }
  }

  if (nextFreeIndex == null) {
    throw new OperationError(`Could not find a free identity index within ${scanLimit} attempts`, 'internal')
  }

  return {identities, nextFreeIndex}
}
