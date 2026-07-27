import {PlatformOperations} from '../../../types/messages'
import {OperationContext} from '../../types'

type Result = PlatformOperations['poolInfo']['result']

export async function poolInfo(ctx: OperationContext): Promise<Result> {
  const [poolState, notesCount] = await Promise.all([
    ctx.sdk.shielded.getShieldedPoolState(),
    ctx.sdk.shielded.getShieldedNotesCount(),
  ])
  return {poolState: poolState ?? null, notesCount: notesCount ?? null}
}