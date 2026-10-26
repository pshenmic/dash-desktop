import {COIN_TYPE, IDENTITY_SCAN_LIMIT} from '../constants/addresses'
import {Network} from '../types/Network'
import {DerivedKeyHash, IdentityKeyDescriptor} from '../types/IdentityKeys'
import {PlatformWorkerService} from '../services/platform/PlatformWorkerService'
import {IdentityDAO} from '../database/IdentityDAO'

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

// Starts past every local identity as well, so an index this wallet already
// recorded is not handed out again.
export async function nextIdentityIndex(
  identityDAO: IdentityDAO,
  platform: PlatformWorkerService,
  walletId: string,
  seed: Uint8Array,
  network: Network,
): Promise<number> {
  const localIdentities = await identityDAO.getIdentitiesByWalletId(walletId)
  const startIndex = localIdentities.reduce((max, identity) => Math.max(max, identity.identityIndex + 1), 0)
  return findNextIdentityIndex(platform, seed, startIndex, network)
}

// The path recorded on every identity row. Four services wrote this literal;
// they must agree or the same identity gets two different recorded paths.
export function identityPath(network: 'mainnet' | 'testnet', identityIndex: number): string {
  return `m/9'/${COIN_TYPE[network]}'/0'/0/${identityIndex}`
}

export function matchIdentityKey(
  identityKeys: IdentityKeyDescriptor[],
  derivedHashes: DerivedKeyHash[],
): { keyId: number; keyIndex: number } | null {
  const keyIndexByHash = new Map(
    derivedHashes.map(derived => [derived.publicKeyHashHex.toLowerCase(), derived.keyIndex]),
  )

  const transferKeys = identityKeys
    .filter(key => key.purpose.toUpperCase() === 'TRANSFER')
    .sort((a, b) => a.keyId - b.keyId)

  for (const key of transferKeys) {
    const keyIndex = keyIndexByHash.get(key.publicKeyHashHex.toLowerCase())
    if (keyIndex != null) {
      return { keyId: key.keyId, keyIndex }
    }
  }

  return null
}
