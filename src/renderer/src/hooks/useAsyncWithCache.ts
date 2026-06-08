import { useEffect, useRef, useState } from 'react'

const cache = new Map<string, unknown>()
const inflight = new Map<string, Promise<unknown>>()

function runFetch<T>(cacheKey: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = inflight.get(cacheKey)
  if (existing !== undefined) return existing as Promise<T>

  const p = fetcher()
    .then((result) => {
      cache.set(cacheKey, result)
      return result
    })
    .finally(() => {
      inflight.delete(cacheKey)
    })

  inflight.set(cacheKey, p)
  return p
}

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

  const [data, setData] = useState<T>(initial)
  const [loading, setLoading] = useState(cacheKey !== undefined)
  const [err, setErr] = useState<string | null>(null)

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
    setErr(null)

    const cached = cache.get(cacheKey) as T | undefined
    let rafId: number | undefined

    if (cached !== undefined) {
      rafId = requestAnimationFrame(() => {
        if (dead) return
        setData(cached)
        setLoading(false)
      })
    } else {
      setLoading(true)
    }

    runFetch(cacheKey, fetcherRef.current)
      .then((result) => {
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

    return () => {
      dead = true
      if (rafId !== undefined) cancelAnimationFrame(rafId)
    }
  }, [cacheKey])

  return { data, loading, err }
}

export function invalidateAsyncCache(namespace: string, key: string): void {
  cache.delete(`${namespace}:${key}`)
}

export function prefetchAsyncCache<T>(
  namespace: string,
  key: string,
  fetcher: () => Promise<T>
): Promise<void> {
  const cacheKey = `${namespace}:${key}`
  if (cache.has(cacheKey)) return Promise.resolve()
  return runFetch(cacheKey, fetcher).then(() => {}).catch(() => {})
}
