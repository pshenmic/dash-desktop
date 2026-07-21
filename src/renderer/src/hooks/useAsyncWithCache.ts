import { useEffect, useRef, useState } from 'react'

const cache = new Map<string, unknown>()
const inflight = new Map<string, Promise<unknown>>()
const listeners = new Map<string, Set<() => void>>()
const refreshTimers = new Map<string, { timer: ReturnType<typeof setInterval>; count: number }>()

function subscribe(cacheKey: string, listener: () => void): () => void {
  const set = listeners.get(cacheKey) ?? new Set()
  set.add(listener)
  listeners.set(cacheKey, set)
  return () => {
    set.delete(listener)
    if (set.size === 0) listeners.delete(cacheKey)
  }
}

function notify(cacheKey: string): void {
  const set = listeners.get(cacheKey)
  if (set) for (const listener of [...set]) listener()
}

function runFetch<T>(cacheKey: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = inflight.get(cacheKey)
  if (existing !== undefined) return existing as Promise<T>

  const p = fetcher()
    .then((result) => {
      cache.set(cacheKey, result)
      notify(cacheKey)
      return result
    })
    .finally(() => {
      inflight.delete(cacheKey)
    })

  inflight.set(cacheKey, p)
  return p
}

function retainRefreshTimer(cacheKey: string, intervalMs: number, fetcher: () => Promise<unknown>): () => void {
  let entry = refreshTimers.get(cacheKey)
  if (!entry) {
    entry = {
      timer: setInterval(() => {
        runFetch(cacheKey, fetcher).catch(() => {})
      }, intervalMs),
      count: 0
    }
    refreshTimers.set(cacheKey, entry)
  }
  entry.count++
  return () => {
    const current = refreshTimers.get(cacheKey)
    if (!current) return
    current.count--
    if (current.count <= 0) {
      clearInterval(current.timer)
      refreshTimers.delete(cacheKey)
    }
  }
}

export interface UseAsyncWithCacheOptions {
  errorMessage?: string
  refreshIntervalMs?: number
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
  const [refetchTick, setRefetchTick] = useState(0)

  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  useEffect(() => {
    if (cacheKey === undefined) return
    return subscribe(cacheKey, () => {
      const cached = cache.get(cacheKey) as T | undefined
      if (cached !== undefined) {
        setData(cached)
        setLoading(false)
        setErr(null)
      } else {
        setRefetchTick((t) => t + 1)
      }
    })
  }, [cacheKey])

  const refreshIntervalMs = options?.refreshIntervalMs
  useEffect(() => {
    if (cacheKey === undefined || refreshIntervalMs === undefined) return
    return retainRefreshTimer(cacheKey, refreshIntervalMs, () => fetcherRef.current())
  }, [cacheKey, refreshIntervalMs])

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
  }, [cacheKey, refetchTick])

  return { data, loading, err }
}

export function invalidateAsyncCache(namespace: string, key: string): void {
  const cacheKey = `${namespace}:${key}`
  cache.delete(cacheKey)
  notify(cacheKey)
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
