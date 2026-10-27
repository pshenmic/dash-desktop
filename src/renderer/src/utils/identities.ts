import type { IdentityKeyDto } from '@renderer/api/types'
import { IDENTITIES_ROUTES, IDENTITY_ROUTE_PARAM } from '@renderer/constants/identities'

export function identityHref(identifier: string): string {
  return IDENTITIES_ROUTES.identity.replace(IDENTITY_ROUTE_PARAM, encodeURIComponent(identifier))
}

export function identityAddKeysHref(identifier: string): string {
  return IDENTITIES_ROUTES.addKeys.replace(IDENTITY_ROUTE_PARAM, encodeURIComponent(identifier))
}

export function isIdentityKeyActive(key: Pick<IdentityKeyDto, 'disabledAt'>): boolean {
  return key.disabledAt == null
}

export function activeKeysCount(keys: IdentityKeyDto[]): number {
  return keys.filter(isIdentityKeyActive).length
}
