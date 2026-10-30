import { API } from '@renderer/api'
import type { UsernameDto } from '@renderer/api/types'
import { DASHPAY_CACHE_NAMESPACES, DASHPAY_LOAD_ERRORS } from '@renderer/constants/dashPay'
import { invalidateAsyncCache, prefetchAsyncCache, useAsyncWithCache } from './useAsyncWithCache'

export function useDashPayUsernames(walletId: string | undefined) {
  const { data, loading, err } = useAsyncWithCache<UsernameDto[]>(
    DASHPAY_CACHE_NAMESPACES.usernames,
    walletId,
    () => API.getUsernames(walletId!),
    [],
    { errorMessage: DASHPAY_LOAD_ERRORS.usernames }
  )
  return { usernames: data, loading, err }
}

export function refreshDashPayUsernames(walletId: string): Promise<void> {
  invalidateAsyncCache(DASHPAY_CACHE_NAMESPACES.usernames, walletId)
  return prefetchAsyncCache(DASHPAY_CACHE_NAMESPACES.usernames, walletId, () => API.getUsernames(walletId))
}
