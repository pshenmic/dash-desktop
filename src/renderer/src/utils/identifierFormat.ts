import { IDENTIFIER_LIKE_PATTERN } from '@renderer/constants/identifierFormat'
import type { IdentityApiDto } from '@renderer/hooks/useIdentities'

export function isIdentifierLike(value: string): boolean {
  return IDENTIFIER_LIKE_PATTERN.test(value.trim())
}

export function identityName(identity: Pick<IdentityApiDto, 'alias' | 'aliasesList'>): string | null {
  return identity.aliasesList[0] ?? identity.alias ?? null
}

export function identityLabel(identity: Pick<IdentityApiDto, 'identifier' | 'alias' | 'aliasesList'>): string {
  return identityName(identity) ?? identity.identifier
}
