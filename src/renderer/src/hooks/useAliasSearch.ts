import { useCallback, useEffect, useState } from 'react'
import { API } from '@renderer/api'
import {
  ALIAS_SEARCH_DEBOUNCE_MS,
  ALIAS_SEARCH_MIN_CHARS,
  DASHPAY_CACHE_NAMESPACES,
  DASHPAY_LOAD_ERRORS,
  EMPTY_ALIAS_SEARCH,
} from '@renderer/constants/dashPay'
import type { AliasSearchPage } from '@renderer/types/Dpns'
import { invalidateAsyncCache, useAsyncWithCache } from './useAsyncWithCache'

export function useAliasSearch(walletId: string | undefined, prefix: string) {
  const [debounced, setDebounced] = useState(prefix)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(prefix), ALIAS_SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [prefix])

  const searching = walletId !== undefined && prefix.length >= ALIAS_SEARCH_MIN_CHARS
  const settled = searching && debounced === prefix
  const key = settled ? `${walletId}:${prefix}` : undefined
  const { data, loading, err } = useAsyncWithCache<AliasSearchPage>(
    DASHPAY_CACHE_NAMESPACES.aliasSearch,
    key,
    () => API.searchAliases(walletId!, prefix).then(results => ({ query: prefix, results })),
    EMPTY_ALIAS_SEARCH,
    { errorMessage: DASHPAY_LOAD_ERRORS.aliasSearch }
  )

  const failed = settled && err != null
  const current = settled && data.query === prefix

  const retry = useCallback(() => {
    if (key !== undefined) invalidateAsyncCache(DASHPAY_CACHE_NAMESPACES.aliasSearch, key)
  }, [key])

  return {
    results: current ? data.results : EMPTY_ALIAS_SEARCH.results,
    loading: searching && !failed && (!current || loading),
    err: failed ? err : null,
    retry,
  }
}
