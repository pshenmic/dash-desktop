import {DashPlatformSDK} from 'dash-platform-sdk'
import {RecoveredNoteWASM} from 'pshenmic-dpp'

import {CheckedNote} from '../../types/service'

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

  return recovered.map(recoveredNote => ({recoveredNote, spent: byNullifier.get(hex(recoveredNote.nullifier)) === true}))
}
