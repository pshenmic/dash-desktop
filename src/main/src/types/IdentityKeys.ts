export interface IdentityKeyDescriptor {
  keyId: number
  purpose: string
  securityLevel: string
  publicKeyHashHex: string
}

export interface DerivedKeyHash {
  keyIndex: number
  publicKeyHashHex: string
}

// Limits a key to one contract, or to one document type of it.
export interface IdentityKeyBounds {
  contractId: string
  documentType: string | null
}

// As iOS offers them, plus MASTER to replace the MASTER key. Drive refuses, before
// charging, any pairing but TRANSFER CRITICAL, ENCRYPTION and DECRYPTION MEDIUM,
// and AUTHENTICATION at any level.
export type CreatableKeyPurpose = 'AUTHENTICATION' | 'ENCRYPTION' | 'DECRYPTION' | 'TRANSFER'
export type CreatableKeySecurityLevel = 'MASTER' | 'CRITICAL' | 'HIGH' | 'MEDIUM'

// A key to derive from the mnemonic and register on an identity. Always
// ECDSA_SECP256K1, the only type this wallet derives.
export interface IdentityKeyRequest {
  purpose: CreatableKeyPurpose
  securityLevel: CreatableKeySecurityLevel
  contractBounds: IdentityKeyBounds | null
}

// One identity update: keys to derive and add, and ids of keys to disable.
export interface IdentityKeysUpdate {
  add: IdentityKeyRequest[]
  disable: number[]
}

// A key of an identity that this wallet derives, which only the seed reveals.
export interface IdentityPrivateKey {
  keyId: number
  wif: string
  hex: string
}

export interface IdentityKey {
  keyId: number
  purpose: string
  securityLevel: string
  keyType: string
  // The public key, hex.
  data: string
  readOnly: boolean
  // When it was disabled, in milliseconds; null while it is in use.
  disabledAt: number | null
  contractBounds: IdentityKeyBounds | null
}
