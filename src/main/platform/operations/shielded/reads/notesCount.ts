import {PlatformOperations} from '../../../types/messages'
import {OperationContext} from '../../types'

type Result = PlatformOperations['notesCount']['result']

export async function notesCount(ctx: OperationContext): Promise<Result> {
  const count = await ctx.sdk.shielded.getShieldedNotesCount()
  return {count: count ?? null}
}