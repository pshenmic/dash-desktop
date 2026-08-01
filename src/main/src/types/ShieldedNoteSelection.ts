export interface SelectableNote {
  index: number
  value: bigint
}

export interface NoteSelectionResult {
  selected: SelectableNote[]
  total: bigint
  feeCredits: bigint
}

export type SpendFeeForCount = (numSpends: number) => bigint