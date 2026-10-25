export type MasternodeKeyRole = 'voting' | 'owner' | 'operator' | 'platformNode'

// What a wallet persists to derive its provider keys without the seed. The
// operator node is BLS, which has no xpub encoding; its public key is the
// standard compressed G1 point. Platform node keys are ed25519, indexed 0'…
export interface MasternodeKeys {
  votingXpub: string
  ownerXpub: string
  operatorPublicKey: Uint8Array
  operatorChainCode: Uint8Array
  platformNodeKeys: Uint8Array[]
}

export interface ExtendedSecretKey {
  privateKey: Uint8Array
  chainCode: Uint8Array
}
