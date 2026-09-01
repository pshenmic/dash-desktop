import {
  NoteSelectionResult,
  OwnedNote,
  SelectableNote,
  ShieldedRecipient,
  ShieldedSpendSource,
  SpendFeeForCount,
} from '../types/ShieldedNoteSelection'
import {MAX_SPEND_RECIPIENTS, MIN_BUNDLE_ACTIONS} from '../constants/credits'

// One action per note spent, one per shielded output, and the change note takes
// a slot even at zero value.
export function bundleActions(numSpends: number, numOutputs: number): number {
  return Math.max(numSpends, numOutputs + 1, MIN_BUNDLE_ACTIONS)
}

// Every note a bundle pays out to, and the amount it has to fund. Each output
// is another Orchard action, which is what the recipient cap counts.
export function requireShieldedRecipients(recipients: ShieldedRecipient[]): bigint {
  if (recipients.length === 0 || recipients.length > MAX_SPEND_RECIPIENTS) {
    throw new Error(`Recipient count must be between 1 and ${MAX_SPEND_RECIPIENTS}`)
  }
  for (const recipient of recipients) {
    if (recipient.amountCredits <= 0n) {
      throw new Error('Every recipient must be paid more than zero credits')
    }
  }
  return recipients.reduce((sum, recipient) => sum + recipient.amountCredits, 0n)
}

function byValueDesc(a: SelectableNote, b: SelectableNote): number {
  if (a.value !== b.value) return a.value > b.value ? -1 : 1
  return a.index - b.index
}

const totalOf = (notes: SelectableNote[]): bigint =>
  notes.reduce((sum, note) => sum + note.value, 0n)

// Every note a spend may draw on. The quote and the spend read their spent
// flags from different places — our bookkeeping and a live nullifier query —
// so this is the one filter that decides what either of them may pick from.
export function selectableNotes(
  notes: OwnedNote[],
  source?: ShieldedSpendSource | null,
): SelectableNote[] {
  const restricted = source == null ? null : new Set(source.noteIndexes)
  const selectable = notes
    .filter(note => !note.spent)
    .filter(note => restricted == null || restricted.has(note.index))
    .map(({index, value}) => ({index, value}))

  // A narrowed spend prices whatever survived, but one that quietly used fewer
  // notes than were picked would break the promise picking them makes.
  if (source?.kind === 'notes' && selectable.length !== source.noteIndexes.length) {
    throw new Error('Selected note is no longer spendable')
  }
  return selectable
}

export function selectSpendNotes(
  notes: SelectableNote[],
  amount: bigint,
  maxNotes: number,
  feeForCount: SpendFeeForCount,
  source?: ShieldedSpendSource | null,
): NoteSelectionResult | null {
  // A picked set is spent whole rather than walked: stopping early would leave
  // out notes the user asked to spend, which is the one thing picking them means.
  if (source?.kind === 'notes') {
    if (notes.length === 0 || notes.length > maxNotes) return null
    const total = totalOf(notes)
    const feeCredits = feeForCount(notes.length)
    return total >= amount + feeCredits ? {selected: [...notes], total, feeCredits} : null
  }

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
  source?: ShieldedSpendSource | null,
): bigint {
  // No prefix to choose from when every picked note is spent: the price is the
  // one the picked count carries, whether or not a smaller set would be cheaper.
  if (source?.kind === 'notes') {
    if (notes.length === 0 || notes.length > maxNotes) return 0n
    const spendable = totalOf(notes) - feeForCount(notes.length)
    return spendable > 0n ? spendable : 0n
  }

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
