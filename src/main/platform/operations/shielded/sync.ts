import {PlatformOperations} from '../../types/messages'
import {OperationContext, throwIfAborted} from '../types'
import {checkSpent} from './checkSpent'
import {SHIELDED_ACCOUNT} from '../../../src/constants'

type Payload = PlatformOperations['sync']['payload']
type Result = PlatformOperations['sync']['result']

export async function sync(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {seed, notes: all} = payload

  ctx.progress('recovering', all.length, all.length)
  const recovered = ctx.sdk.shielded.recoverNotes(all, seed, SHIELDED_ACCOUNT)
  throwIfAborted(ctx.signal)

  const checked = await checkSpent(ctx.sdk, recovered)

  let balance = 0n
  const notes = checked.map(({recoveredNote, spent}) => {
    if (!spent) balance += recoveredNote.note.value
    return {
      // recoverNotes indexes by array position; map it back to the pool index.
      index: all[recoveredNote.index]?.index ?? recoveredNote.index,
      amount: recoveredNote.note.value,
      spent,
      address: recoveredNote.note.address.toBech32m(ctx.network),
    }
  })
  notes.sort((a, b) => b.index - a.index)

  return {balance, notes}
}
