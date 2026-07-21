import type { ShieldedNoteInfo } from '../api/types'

export function shieldedBalancesByAddress(notes: ShieldedNoteInfo[]): Map<string, bigint> {
  const map = new Map<string, bigint>()
  for (const note of notes) {
    if (note.spent) continue
    map.set(note.address, (map.get(note.address) ?? 0n) + BigInt(note.amount))
  }
  return map
}
