import {PlatformOperations} from '../types/messages'
import {OperationContext} from './types'

type Result = PlatformOperations['nodeStatus']['result']

export function nodeStatus(ctx: OperationContext): Promise<Result> {
  return ctx.sdk.node.status()
}
