import { API } from '@renderer/api'
import { prefetchAsyncCache, useAsyncWithCache } from './useAsyncWithCache'

export type IdentityApiDto = {
  identityIndex: number
  identifier: string
  alias: string | null
  balance: {
    amount: bigint
    usdAmount: string
  }
  derivationPath: string
}

const fetchIdentities = (walletId: string): Promise<IdentityApiDto[]> =>
  API.getIdentities(walletId).then((d) => (d ?? []) as IdentityApiDto[])

export function useIdentities(walletId?: string) {
  const { data: identities, loading, err } = useAsyncWithCache<IdentityApiDto[]>(
    'identities',
    walletId,
    () => fetchIdentities(walletId!),
    [],
    { errorMessage: 'Failed to load identities' }
  )
  return { identities, loading, err }
}

export function prefetchIdentities(walletId: string): Promise<void> {
  return prefetchAsyncCache('identities', walletId, () => fetchIdentities(walletId))
}
