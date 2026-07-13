export interface IdentityKeyDescriptor {
  keyId: number
  purpose: string
  publicKeyHashHex: string
}

export interface DerivedKeyHash {
  keyIndex: number
  publicKeyHashHex: string
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
