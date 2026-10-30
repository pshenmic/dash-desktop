import { useMemo } from 'react'
import type { IdentityApiDto } from './useIdentities'

export function useWalletIdentifiers(identities: IdentityApiDto[]): ReadonlySet<string> {
  return useMemo(() => new Set(identities.map(identity => identity.identifier)), [identities])
}
