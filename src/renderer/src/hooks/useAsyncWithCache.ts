import { useEffect, useRef, useState } from 'react'

const cache = new Map<string, unknown>()

export interface UseAsyncWithCacheOptions {
  errorMessage?: string
}

export function useAsyncWithCache<T>(
  namespace: string,
  key: string | undefined,
  fetcher: () => Promise<T>,
  initial: T,
  options?: UseAsyncWithCacheOptions
): { data: T; loading: boolean; err: string | null } {
  const cacheKey = key !== undefined ? `${namespace}:${key}` : undefined
  const cached = cacheKey !== undefined ? (cache.get(cacheKey) as T | undefined) : undefined

  const [data, setData] = useState<T>(cached ?? initial)
  const [loading, setLoading] = useState(cacheKey !== undefined && cached === undefined)
  const [err, setErr] = useState<string | null>(null)

  // Keep the latest fetcher in a ref so the effect doesn't have to depend on it,
  // while still using the freshest closure when (re-)fetching.
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  useEffect(() => {
    if (cacheKey === undefined) {
      setData(initial)
      setLoading(false)
      setErr(null)
      return
    }

    let dead = false
    if (!cache.has(cacheKey)) setLoading(true)
    setErr(null)

    fetcherRef.current()
      .then((result) => {
        // Update the cache even if the component has unmounted, so the next
        // mount sees fresh data instead of stale cache.
        cache.set(cacheKey, result)
        if (dead) return
        setData(result)
      })
      .catch((e) => {
        console.error(`[${namespace}] fetch failed:`, e)
        if (!dead) {
          setErr(options?.errorMessage ?? (e instanceof Error ? e.message : 'Failed'))
        }
      })
      .finally(() => {
        if (!dead) setLoading(false)
      })

    return () => { dead = true }
  }, [cacheKey])

  return { data, loading, err }
}

export function invalidateAsyncCache(namespace: string, key: string): void {
  cache.delete(`${namespace}:${key}`)
}
