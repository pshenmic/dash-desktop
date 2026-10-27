import type { DashPayContactDto } from '@renderer/api/types'
import { DASHPAY_PARAMS } from '@renderer/constants/dashPay'
import { ActiveIdentitySource, DashPayContactRelationship, DashPayReadiness } from '@renderer/enums/DashPay'
import type { IdentityApiDto } from '@renderer/hooks/useIdentities'
import type { ActiveIdentityInput, ActiveIdentityResolution } from '@renderer/types/DashPay'
import { dashPayMissingKeys, dashPayReadiness } from './dashPayReadiness'
import { matchesIdentityQuery } from './dpnsLabel'
import { withParams } from './searchParams'

export function resolveActiveIdentity({ identities, requested, stored }: ActiveIdentityInput): ActiveIdentityResolution {
  const ordered = [...identities].sort((a, b) => a.identityIndex - b.identityIndex)
  const requestedIdentity = ordered.find(identity => identity.identifier === requested)
  if (requestedIdentity != null) return { identity: requestedIdentity, source: ActiveIdentitySource.Requested }
  const storedIdentity = ordered.find(identity => identity.identifier === stored)
  if (storedIdentity != null) return { identity: storedIdentity, source: ActiveIdentitySource.Stored }
  const fallback = ordered.find(identity => dashPayReadiness(identity).readiness === DashPayReadiness.Ready)
    ?? ordered.find(identity => identity.usernames.length > 0)
    ?? ordered.find(identity => dashPayMissingKeys(identity.keys).length === 0)
    ?? ordered[0]
  if (fallback == null) return { identity: null, source: ActiveIdentitySource.None }
  return { identity: fallback, source: ActiveIdentitySource.Fallback }
}

export function filterIdentities(identities: IdentityApiDto[], query: string): IdentityApiDto[] {
  return identities.filter(identity => matchesIdentityQuery(identity.identifier, [identity.alias, ...identity.usernames], query))
}

export function incomingCountByIdentity(contacts: DashPayContactDto[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const contact of contacts) {
    if (contact.relationship !== DashPayContactRelationship.Incoming) continue
    counts[contact.identifier] = (counts[contact.identifier] ?? 0) + 1
  }
  return counts
}

export function dashPayHref(path: string, identifier: string | null, params: Record<string, string | null> = {}): string {
  return `${path}?${withParams('', { [DASHPAY_PARAMS.identity]: identifier, ...params })}`
}
