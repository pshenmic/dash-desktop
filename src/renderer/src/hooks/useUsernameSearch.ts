import { useCallback, useEffect, useState } from 'react'
import { API } from '@renderer/api'
import {
  USERNAME_SEARCH_DEBOUNCE_MS,
  USERNAME_SEARCH_MIN_CHARS,
  DASHPAY_CACHE_NAMESPACES,
  DASHPAY_LOAD_ERRORS,
  EMPTY_USERNAME_SEARCH,
} from '@renderer/constants/dashPay'
import type { UsernameSearchPage } from '@renderer/types/Dpns'
import { invalidateAsyncCache, useAsyncWithCache } from './useAsyncWithCache'

export function useUsernameSearch(walletId: string | undefined, prefix: string) {
  const [debounced, setDebounced] = useState(prefix)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(prefix), USERNAME_SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [prefix])

  const searching = walletId !== undefined && prefix.length >= USERNAME_SEARCH_MIN_CHARS
  const settled = searching && debounced === prefix
  const key = settled ? `${walletId}:${prefix}` : undefined
  const { data, loading, err } = useAsyncWithCache<UsernameSearchPage>(
    DASHPAY_CACHE_NAMESPACES.usernameSearch,
    key,
    () => API.searchUsernames(walletId!, prefix).then(results => ({ query: prefix, results })),
    EMPTY_USERNAME_SEARCH,
    { errorMessage: DASHPAY_LOAD_ERRORS.usernameSearch }
  )

  const failed = settled && err != null
  const current = settled && data.query === prefix

  const retry = useCallback(() => {
    if (key !== undefined) invalidateAsyncCache(DASHPAY_CACHE_NAMESPACES.usernameSearch, key)
  }, [key])

  return {
    results: current ? data.results : EMPTY_USERNAME_SEARCH.results,
    loading: searching && !failed && (!current || loading),
    err: failed ? err : null,
    retry,
  }
}
