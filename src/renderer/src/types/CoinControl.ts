export type CoinControlSelection =
  | { kind: 'automatic' }
  | { kind: 'coreAddress'; address: string }
  | { kind: 'coreOutpoints'; outpoints: string[] }
  | { kind: 'platformAddress'; address: string }
  | { kind: 'platformInputs'; inputs: Array<{address: string; credits: bigint}>; feeAddress: string }
  | { kind: 'shieldedAddress'; address: string }
  | { kind: 'shieldedNotes'; noteIndexes: number[] }

export interface CoinControlInventory {
  coreAddresses: string[]
  coreOutpoints: string[]
  platformBalances: Record<string, bigint>
  shieldedAddresses: string[]
  shieldedNoteIndexes: number[]
}
