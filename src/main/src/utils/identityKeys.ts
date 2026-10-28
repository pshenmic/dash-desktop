import {COIN_TYPE, IDENTITY_SCAN_LIMIT} from '../constants/addresses'
import {Network} from '../types/Network'
import {DerivedKeyHash, IdentityKeyDescriptor, IdentityKeysUpdate} from '../types/IdentityKeys'
import {PlatformWorkerService} from '../services/platform/PlatformWorkerService'

// The first index Platform does not already know an identity at. Registration
// and the pool spend both need it, and neither may own the other.
export async function findNextIdentityIndex(
  platform: PlatformWorkerService,
  seed: Uint8Array,
  startIndex: number,
  network: Network,
): Promise<number> {
  const {nextFreeIndex} = await platform.request('identityScan', network, {
    seed,
    startIndex,
    gapLimit: 1,
    scanLimit: IDENTITY_SCAN_LIMIT,
  })
  return nextFreeIndex
}

// The path recorded on every identity row. Four services wrote this literal;
// they must agree or the same identity gets two different recorded paths.
export function identityPath(network: 'mainnet' | 'testnet', identityIndex: number): string {
  return `m/9'/${COIN_TYPE[network]}'/0'/0/${identityIndex}`
}

export function matchIdentityKey(
  identityKeys: IdentityKeyDescriptor[],
  derivedHashes: DerivedKeyHash[],
  purpose: string,
  securityLevel?: string,
): { keyId: number; keyIndex: number } | null {
  const keyIndexByHash = new Map(
    derivedHashes.map(derived => [derived.publicKeyHashHex.toLowerCase(), derived.keyIndex]),
  )

  const wantedKeys = identityKeys
    .filter(key => key.purpose.toUpperCase() === purpose && (securityLevel == null || key.securityLevel.toUpperCase() === securityLevel))
    .sort((a, b) => a.keyId - b.keyId)

  for (const key of wantedKeys) {
    const keyIndex = keyIndexByHash.get(key.publicKeyHashHex.toLowerCase())
    if (keyIndex != null) {
      return { keyId: key.keyId, keyIndex }
    }
  }

  return null
}

// Why Drive would refuse this update after charging a nonce bump, or accept it for
// nothing; null when it can go out. A MASTER key is replaced only one for one.
export function identityKeysUpdateError(
  {add, disable}: IdentityKeysUpdate,
  existing: Array<{keyId: number; securityLevel: string; disabled: boolean}>,
): string | null {
  for (const keyId of disable) {
    const key = existing.find(candidate => candidate.keyId === keyId)
    if (key == null) return `This identity has no key ${keyId}`
    if (key.disabled) return `Key ${keyId} is already disabled`
  }

  const added = add.filter(key => key.securityLevel === 'MASTER').length
  const disabled = existing.filter(key => key.securityLevel === 'MASTER' && disable.includes(key.keyId)).length
  if (added > 1 || added !== disabled) return 'A MASTER key can only be replaced: add one and disable the current one in the same update'
  return null
}
