export interface PersistNote {
  index: number
  amount: bigint
  address: string
  spent: boolean
}

export interface EncryptedNoteRecord {
  index: number
  nullifier: Uint8Array
  cmx: Uint8Array
  encryptedNote: Uint8Array
  cvNet: Uint8Array
}
