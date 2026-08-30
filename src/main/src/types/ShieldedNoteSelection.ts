export interface SelectableNote {
  index: number
  value: bigint
}

// A note as the wallet knows it, before the spent ones are dropped. Both the
// quote and the spend hold this much; only the freshness of `spent` differs.
export interface OwnedNote extends SelectableNote {
  spent: boolean
}

// How a pool spend was restricted to part of the balance. An address narrows
// the notes the automatic selection draws from and still lets it pick; a note
// list is the spend set itself, spent whole, which is the only way a spend can
// consolidate notes an amount would never have reached for.
export type ShieldedSpendSource =
  | {kind: 'address'; noteIndexes: number[]}
  | {kind: 'notes'; noteIndexes: number[]}

export interface NoteSelectionResult {
  selected: SelectableNote[]
  total: bigint
  feeCredits: bigint
}

export type SpendFeeForCount = (numSpends: number) => bigint
