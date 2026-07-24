import {KeyType, PrivateKeyWASM, Purpose, SecurityLevel} from 'dash-platform-sdk/types.js'
import {Network} from '../types'

// Protocol limits IdentityCreateTransition to 6 public keys. AUTH MEDIUM is
// dropped (added later via IdentityUpdateTransition if needed); MASTER /
// CRITICAL / HIGH plus ENCRYPTION / DECRYPTION / TRANSFER cover the common path.
export const IDENTITY_KEY_DEFINITIONS = [
  {id: 0, purpose: Purpose.AUTHENTICATION, securityLevel: SecurityLevel.MASTER, keyType: KeyType.ECDSA_SECP256K1},
  {id: 1, purpose: Purpose.AUTHENTICATION, securityLevel: SecurityLevel.CRITICAL, keyType: KeyType.ECDSA_SECP256K1},
  {id: 2, purpose: Purpose.AUTHENTICATION, securityLevel: SecurityLevel.HIGH, keyType: KeyType.ECDSA_SECP256K1},
  {id: 3, purpose: Purpose.ENCRYPTION, securityLevel: SecurityLevel.MEDIUM, keyType: KeyType.ECDSA_SECP256K1},
  {id: 4, purpose: Purpose.DECRYPTION, securityLevel: SecurityLevel.MEDIUM, keyType: KeyType.ECDSA_SECP256K1},
  {id: 5, purpose: Purpose.TRANSFER, securityLevel: SecurityLevel.CRITICAL, keyType: KeyType.ECDSA_SECP256K1},
] as const

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

export function parseIdentityPrivateKey(value: string, network: Network): PrivateKeyWASM {
  const trimmed = value.trim()

  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return PrivateKeyWASM.fromHex(trimmed, network)
  }

  if (/^[1-9A-HJ-NP-Za-km-z]{51,52}$/.test(trimmed)) {
    return PrivateKeyWASM.fromWIF(trimmed)
  }

  throw new Error('Private keys must be 64-character hex or WIF')
}
