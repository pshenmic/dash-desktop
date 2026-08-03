import {PlatformOperations} from '../../../types/messages'
import {OperationContext, throwIfAborted} from '../../types'

type Payload = PlatformOperations['encryptedNotes']['payload']
type Result = PlatformOperations['encryptedNotes']['result']

export async function encryptedNotes(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {startIndex, count} = payload
  const batch = await ctx.sdk.shielded.getShieldedEncryptedNotes(BigInt(startIndex), count)
  throwIfAborted(ctx.signal)
  return {
    notes: batch.map((note, i) => ({
      index: startIndex + i,
      nullifier: note.nullifier,
      cmx: note.cmx,
      encryptedNote: note.encryptedNote,
      cvNet: note.cvNet,
    })),
  }
}