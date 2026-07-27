import {DashPlatformSDK} from 'dash-platform-sdk'
import {RecoveredNoteWASM} from 'pshenmic-dpp'

export interface CheckedNote {
  note: RecoveredNoteWASM
  spent: boolean
}

const hex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex')

// The chain is the only authority on whether a note is spent — local
// bookkeeping misses anything spent from another install. Statuses are matched
// by nullifier, not by array position: the response order is not contractual.
export async function checkSpent(
  sdk: DashPlatformSDK,
  recovered: RecoveredNoteWASM[],
): Promise<CheckedNote[]> {
  if (recovered.length === 0) return []

  const statuses = await sdk.shielded.getShieldedNullifiers(recovered.map(note => note.nullifier))
  const byNullifier = new Map(statuses.map(status => [hex(status.nullifier), status.isSpent]))

  return recovered.map(note => ({note, spent: byNullifier.get(hex(note.nullifier)) === true}))
}