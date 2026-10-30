import { API } from '@renderer/api'
import { IdentityKeyDto } from '@renderer/api/types'
import { IDENTITIES_REFRESH_MS } from '@renderer/constants'
import { invalidateAsyncCache, prefetchAsyncCache, useAsyncWithCache } from './useAsyncWithCache'

export type IdentityApiDto = {
  identityIndex: number
  identifier: string
  usernames: string[]
  keys: IdentityKeyDto[]
  balance: {
    amount: bigint
    usdAmount: string
  }
  derivationPath: string
  assetLockTxid: string | null
}

const fetchIdentities = (walletId: string): Promise<IdentityApiDto[]> =>
  API.getIdentities(walletId).then((d) => (d ?? []) as IdentityApiDto[])

export function useIdentities(walletId?: string) {
  const { data: identities, loading, err } = useAsyncWithCache<IdentityApiDto[]>(
    'identities',
    walletId,
    () => fetchIdentities(walletId!),
    [],
    { errorMessage: 'Failed to load identities', refreshIntervalMs: IDENTITIES_REFRESH_MS }
  )
  return { identities, loading, err }
}

export function prefetchIdentities(walletId: string): Promise<void> {
  return prefetchAsyncCache('identities', walletId, () => fetchIdentities(walletId))
}

export function refreshIdentities(walletId: string): Promise<void> {
  invalidateAsyncCache('identities', walletId)
  return prefetchIdentities(walletId)
}
