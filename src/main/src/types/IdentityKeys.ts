export interface IdentityKeyDescriptor {
  keyId: number
  purpose: string
  publicKeyHashHex: string
}

export interface DerivedKeyHash {
  keyIndex: number
  publicKeyHashHex: string
}