import { IDENTIFIER_EDGE_CHARS } from '@renderer/constants/identifier'
import { IDENTIFIER_LIKE_PATTERN, SHORT_IDENTIFIER_ELLIPSIS } from '@renderer/constants/identifierFormat'
import type { IdentityApiDto } from '@renderer/hooks/useIdentities'

export function shortIdentifier(identifier: string): string {
  if (identifier.length <= IDENTIFIER_EDGE_CHARS * 2 + SHORT_IDENTIFIER_ELLIPSIS.length) return identifier
  return `${identifier.slice(0, IDENTIFIER_EDGE_CHARS)}${SHORT_IDENTIFIER_ELLIPSIS}${identifier.slice(-IDENTIFIER_EDGE_CHARS)}`
}

export function isIdentifierLike(value: string): boolean {
  return IDENTIFIER_LIKE_PATTERN.test(value.trim())
}

export function identityLabel(identity: Pick<IdentityApiDto, 'identifier' | 'alias' | 'aliasesList'>): string {
  return identity.aliasesList[0] ?? identity.alias ?? shortIdentifier(identity.identifier)
}
