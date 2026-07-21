import type { ShieldedNoteInfo } from '../api/types'

export function shieldedBalancesByAddress(notes: ShieldedNoteInfo[]): Map<string, bigint> {
  const map = new Map<string, bigint>()
  for (const note of notes) {
    if (note.spent) continue
    map.set(note.address, (map.get(note.address) ?? 0n) + BigInt(note.amount))
  }
  return map
}

export interface ShieldedNoteGroup {
  address: string
  total: bigint
  notes: ShieldedNoteInfo[]
}

export function groupShieldedNotesByAddress(notes: ShieldedNoteInfo[]): ShieldedNoteGroup[] {
  const groups = new Map<string, ShieldedNoteInfo[]>()
  for (const note of notes) {
    if (note.spent) continue
    const list = groups.get(note.address)
    if (list) list.push(note)
    else groups.set(note.address, [note])
  }
  return Array.from(groups, ([address, groupNotes]) => ({
    address,
    notes: groupNotes,
    total: groupNotes.reduce((sum, n) => sum + BigInt(n.amount), 0n),
  })).sort((a, b) => (a.total > b.total ? -1 : a.total < b.total ? 1 : a.address < b.address ? -1 : 1))
}
