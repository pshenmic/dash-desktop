import {HDKey} from '@scure/bip32'
import {Network} from '../types/Network'

import {GapEntry} from '../types/AddressDiscovery'
import {HD_VERSIONS} from '../constants'

// `minBatch` widens an extension past the gap limit once one is needed at all.
// The limit is a floor on how far to look, so overshooting it only widens the
// watch set — but landing exactly on it means the next used address exhausts the
// gap again, and for the cfilter scan each of those costs a rewind.
export function planGapExtension(entries: GapEntry[], gapLimit: number, minBatch = 1): number[] {
  let lastUsed = -1
  let maxIndex = -1
  for (const entry of entries) {
    if (entry.index > maxIndex) maxIndex = entry.index
    if (entry.isUsed && entry.index > lastUsed) lastUsed = entry.index
  }
  if (maxIndex >= lastUsed + gapLimit) return []

  const indexes: number[] = []
  const target = Math.max(lastUsed + gapLimit, maxIndex + minBatch)
  for (let i = maxIndex + 1; i <= target; i++) indexes.push(i)
  return indexes
}

export function coreAccountPath(coinType: number, accountId: number): string {
  return `m/44'/${coinType}'/${accountId}'`
}

export function deriveCorePublicKey(coreXpub: string, network: Network, isChange: boolean, index: number): Uint8Array {
  const accountNode = HDKey.fromExtendedKey(coreXpub, HD_VERSIONS[network])
  const child = accountNode.deriveChild(isChange ? 1 : 0).deriveChild(index)
  if (child.publicKey == null) {
    throw new Error(`Could not derive core public key at index ${index}`)
  }
  return child.publicKey
}
