import { API } from '@renderer/api'
import type { AliasDto } from '@renderer/api/types'
import { DASHPAY_ALIASES_REFRESH_MS, DASHPAY_CACHE_NAMESPACES, DASHPAY_LOAD_ERRORS } from '@renderer/constants/dashPay'
import { invalidateAsyncCache, prefetchAsyncCache, useAsyncWithCache } from './useAsyncWithCache'

export function useDashPayAliases(walletId: string | undefined) {
  const { data, loading, err } = useAsyncWithCache<AliasDto[]>(
    DASHPAY_CACHE_NAMESPACES.aliases,
    walletId,
    () => API.getAliases(walletId!),
    [],
    { errorMessage: DASHPAY_LOAD_ERRORS.aliases, refreshIntervalMs: DASHPAY_ALIASES_REFRESH_MS }
  )
  return { aliases: data, loading, err }
}

export function refreshDashPayAliases(walletId: string): Promise<void> {
  invalidateAsyncCache(DASHPAY_CACHE_NAMESPACES.aliases, walletId)
  return prefetchAsyncCache(DASHPAY_CACHE_NAMESPACES.aliases, walletId, () => API.getAliases(walletId))
}
