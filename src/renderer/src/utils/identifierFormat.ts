import { IDENTIFIER_LIKE_PATTERN } from '@renderer/constants/identifierFormat'
import type { IdentityApiDto } from '@renderer/hooks/useIdentities'

export function isIdentifierLike(value: string): boolean {
  return IDENTIFIER_LIKE_PATTERN.test(value.trim())
}

export function identityName(identity: Pick<IdentityApiDto, 'usernames'>): string | null {
  return identity.usernames[0] ?? null
}

export function identityLabel(identity: Pick<IdentityApiDto, 'identifier' | 'usernames'>): string {
  return identityName(identity) ?? identity.identifier
}
