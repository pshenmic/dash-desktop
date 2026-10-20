import {PlatformOperations} from '../../types/messages'
import {OperationContext} from '../types'
import {findDomain} from './status'

type Payload = PlatformOperations['aliasResolve']['payload']
type Result = PlatformOperations['aliasResolve']['result']

// The owner, not records.identity: a domain is immutable, so a transferred or
// sold name keeps pointing its record at the identity that gave it up.
export async function aliasResolve(payload: Payload, ctx: OperationContext): Promise<Result> {
  const domain = await findDomain(ctx.sdk, ctx.sdk.names.normalizeLabel(payload.label))
  return {identifier: domain?.ownerId.base58() ?? null}
}
