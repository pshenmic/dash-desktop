import {PlatformOperations} from '../../types/messages'
import {OperationContext, throwIfAborted} from '../types'

type Payload = PlatformOperations['identityInfos']['payload']
type Result = PlatformOperations['identityInfos']['result']

// An identifier this wallet recorded before its transition landed is not on
// Platform yet, so it is left out rather than failing the whole batch.
export async function identityInfos(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {sdk} = ctx
  const infos: Result['infos'] = []

  for (const identifier of payload.identifiers) {
    throwIfAborted(ctx.signal)

    const identity = await sdk.identities.getIdentityByIdentifier(identifier).catch(() => null)
    if (identity == null) continue

    const [document] = await sdk.names.searchByIdentity(identifier).catch(() => [])
    const {label, parentDomainName} = document?.properties ?? {}

    infos.push({
      identifier: identity.id.base58(),
      balance: BigInt(identity.balance),
      alias: label != null && parentDomainName != null ? `${label}.${parentDomainName}` : null,
    })
  }

  return {infos}
}