export interface PersistNote {
  index: number
  amount: bigint
  address: string
  spent: boolean
  // Null on rows written before 0019; the next sync fills it.
  nullifier: Uint8Array | null
}

export interface EncryptedNoteRecord {
  index: number
  nullifier: Uint8Array
  cmx: Uint8Array
  encryptedNote: Uint8Array
  cvNet: Uint8Array
}
