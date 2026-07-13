export interface SelectableNote {
  index: number
  value: bigint
}

export interface NoteSelectionResult {
  selected: SelectableNote[]
  total: bigint
}

function byValueDesc(a: SelectableNote, b: SelectableNote): number {
  if (a.value !== b.value) return a.value > b.value ? -1 : 1
  return a.index - b.index
}

export function selectSpendNotes(
  notes: SelectableNote[],
  target: bigint,
  maxNotes: number,
): NoteSelectionResult | null {
  const sorted = [...notes].sort(byValueDesc)
  const selected: SelectableNote[] = []
  let total = 0n
  for (const note of sorted) {
    if (total >= target || selected.length === maxNotes) break
    selected.push(note)
    total += note.value
  }
  return total >= target ? { selected, total } : null
}

export function maxSpendableCredits(notes: SelectableNote[], maxNotes: number, fee: bigint): bigint {
  const top = [...notes].sort(byValueDesc).slice(0, maxNotes)
  const total = top.reduce((sum, note) => sum + note.value, 0n)
  return total > fee ? total - fee : 0n
}
