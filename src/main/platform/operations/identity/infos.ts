import {PlatformOperations} from '../../types/messages'
import {OperationContext, throwIfAborted} from '../types'
import {lookupIdentity} from '../identityLookup'

type Payload = PlatformOperations['identityInfos']['payload']
type Result = PlatformOperations['identityInfos']['result']

// A transfer moves a name's owner but not its records.identity, which the
// search matches on, so only the names still owned are kept, oldest first.
async function resolveAliasesList(sdk: OperationContext['sdk'], identifier: string): Promise<string[]> {
  return (await sdk.names.searchByIdentity(identifier).catch(() => []))
    .filter(document => document.ownerId.base58() === identifier)
    .sort((a, b) => Number(a.createdAt) - Number(b.createdAt))
    .map(document => `${document.properties.label}.${document.properties.parentDomainName}`)
}

// An identifier this wallet recorded before its transition landed is not on
// Platform yet, so it is left out rather than failing the whole batch.
export async function identityInfos(payload: Payload, ctx: OperationContext): Promise<Result> {
  const {sdk} = ctx
  throwIfAborted(ctx.signal)

  const resolved = await Promise.all(payload.identifiers.map(async identifier => {
    const identity = await lookupIdentity(sdk.identities.getIdentityByIdentifier(identifier), identifier)
    if (identity == null) return null

    return {
      identifier: identity.id.base58(),
      balance: BigInt(identity.balance),
      aliasesList: payload.skipDPNS ? [] : await resolveAliasesList(sdk, identifier),
    }
  }))

  return {infos: resolved.filter((info): info is Result['infos'][number] => info != null)}
}