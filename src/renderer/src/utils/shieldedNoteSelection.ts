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

function byValueDesc(a: SelectableNote, b: SelectableNote): number {
  if (a.value !== b.value) return a.value > b.value ? -1 : 1
  return a.index - b.index
}

export function selectSpendNotes(
  notes: SelectableNote[],
  amount: bigint,
  maxNotes: number,
  feeForCount: SpendFeeForCount,
): NoteSelectionResult | null {
  const sorted = [...notes].sort(byValueDesc)
  const selected: SelectableNote[] = []
  let total = 0n
  for (const note of sorted) {
    if (selected.length === maxNotes) break
    selected.push(note)
    total += note.value
    const feeCredits = feeForCount(selected.length)
    if (total >= amount + feeCredits) return { selected, total, feeCredits }
  }
  return null
}

export function maxSpendableCredits(
  notes: SelectableNote[],
  maxNotes: number,
  feeForCount: SpendFeeForCount,
): bigint {
  const top = [...notes].sort(byValueDesc).slice(0, maxNotes)
  let total = 0n
  let best = 0n
  for (let count = 1; count <= top.length; count++) {
    total += top[count - 1].value
    const candidate = total - feeForCount(count)
    if (candidate > best) best = candidate
  }
  return best
}
