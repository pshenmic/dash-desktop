import {COIN_TYPE} from '../constants'
import {DerivedKeyHash, IdentityKeyDescriptor} from '../types/IdentityKeys'

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
