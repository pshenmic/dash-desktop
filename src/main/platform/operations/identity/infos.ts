import {PlatformOperations} from '../../types/messages'
import {OperationContext, throwIfAborted} from '../types'

type Payload = PlatformOperations['identityInfos']['payload']
type Result = PlatformOperations['identityInfos']['result']

async function resolveAlias(sdk: OperationContext['sdk'], identifier: string): Promise<string | null> {
  const [document] = await sdk.names.searchByIdentity(identifier).catch(() => [])
  const {label, parentDomainName} = document?.properties ?? {}
  return label != null && parentDomainName != null ? `${label}.${parentDomainName}` : null
}

// An identifier this wallet recorded before its transition landed is not on
// Platform yet, so it is left out rather than failing the whole batch.
export async function identityInfos(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {sdk} = ctx
  throwIfAborted(ctx.signal)

  const resolved = await Promise.all(payload.identifiers.map(async identifier => {
    const identity = await sdk.identities.getIdentityByIdentifier(identifier).catch(() => null)
    if (identity == null) return null

    return {
      identifier: identity.id.base58(),
      balance: BigInt(identity.balance),
      alias: payload.skipDPNS ? null : await resolveAlias(sdk, identifier),
    }
  }))

  return {infos: resolved.filter((info): info is Result['infos'][number] => info != null)}
}