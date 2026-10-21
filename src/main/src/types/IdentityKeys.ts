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

// MASTER is only minted at registration; SYSTEM, VOTING and OWNER keys are a masternode's.
export type CreatableKeyPurpose = 'AUTHENTICATION' | 'ENCRYPTION' | 'DECRYPTION' | 'TRANSFER'
export type CreatableKeySecurityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM'

// A key to derive from the mnemonic and register on an identity. Always
// ECDSA_SECP256K1, the only type this wallet derives.
export interface IdentityKeyRequest {
  purpose: CreatableKeyPurpose
  securityLevel: CreatableKeySecurityLevel
  contractBounds: IdentityKeyBounds | null
}

export interface IdentityKey {
  keyId: number
  purpose: string
  securityLevel: string
  keyType: string
  disabled: boolean
  contractBounds: IdentityKeyBounds | null
}
