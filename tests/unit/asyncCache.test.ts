import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const reactMock = vi.hoisted(() => ({
  cleanups: [] as Array<() => void>,
  setState: vi.fn()
}))

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    useEffect: (effect: () => void | (() => void)) => {
      const cleanup = effect()
      if (cleanup) reactMock.cleanups.push(cleanup)
    },
    useRef: <T>(initial: T) => ({ current: initial }),
    useState: <T>(initial: T) => [initial, reactMock.setState],
    useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot()
  }
})

import {
  invalidateAllAsyncCaches,
  invalidateAsyncCache,
  prefetchAsyncCache,
  refreshActiveAsyncCaches,
  setAsyncCache,
  useAsyncRefreshFailures,
  useAsyncWithCache
} from '@renderer/hooks/useAsyncWithCache'

async function flushPromises(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubGlobal('requestAnimationFrame', () => 1)
  vi.stubGlobal('cancelAnimationFrame', () => {})
})

afterEach(() => {
  for (const cleanup of reactMock.cleanups.splice(0).reverse()) cleanup()
  invalidateAllAsyncCaches()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('invalidateAllAsyncCaches', () => {
  it('forces every cached namespace to fetch again', async () => {
    let balanceFetches = 0
    let transactionFetches = 0

    const prefetch = async (): Promise<void> => {
      await Promise.all([
        prefetchAsyncCache('test-balance', 'wallet', async () => ++balanceFetches),
        prefetchAsyncCache('test-transactions', 'wallet', async () => ++transactionFetches),
      ])
    }

    await prefetch()
    await prefetch()
    expect([balanceFetches, transactionFetches]).toEqual([1, 1])

    invalidateAllAsyncCaches()
    await prefetch()
    expect([balanceFetches, transactionFetches]).toEqual([2, 2])
  })

  it('clears background refresh failures', async () => {
    useAsyncWithCache(
      'failed-refresh',
      'wallet',
      async () => Promise.reject(new Error('offline')),
      0,
      { refreshIntervalMs: 1_000 }
    )
    await flushPromises()

    expect(useAsyncRefreshFailures().failedCount).toBe(1)
    invalidateAllAsyncCaches()
    expect(useAsyncRefreshFailures().failedCount).toBe(0)
  })
})

describe('staleTimeMs', () => {
  const staleTimeMs = 60_000

  function counter(): { fetches: () => number; fetcher: () => Promise<number> } {
    let fetches = 0
    return { fetches: () => fetches, fetcher: async () => ++fetches }
  }

  it('skips the mount fetch while the cached entry is younger than the window', async () => {
    const { fetches, fetcher } = counter()
    await prefetchAsyncCache('fresh', 'wallet', fetcher)
    vi.advanceTimersByTime(staleTimeMs - 1)

    useAsyncWithCache('fresh', 'wallet', fetcher, 0, { staleTimeMs })
    await flushPromises()

    expect(fetches()).toBe(1)
  })

  it('fetches on mount once the cached entry has aged past the window', async () => {
    const { fetches, fetcher } = counter()
    await prefetchAsyncCache('stale', 'wallet', fetcher)
    vi.advanceTimersByTime(staleTimeMs)

    useAsyncWithCache('stale', 'wallet', fetcher, 0, { staleTimeMs })
    await flushPromises()

    expect(fetches()).toBe(2)
  })

  it('revalidates on every mount when the option is absent', async () => {
    const { fetches, fetcher } = counter()
    await prefetchAsyncCache('unset', 'wallet', fetcher)

    useAsyncWithCache('unset', 'wallet', fetcher, 0)
    await flushPromises()

    expect(fetches()).toBe(2)
  })

  it.each([
    ['invalidateAsyncCache', () => invalidateAsyncCache('invalidated', 'wallet')],
    ['invalidateAllAsyncCaches', invalidateAllAsyncCaches],
  ])('fetches on mount inside the window after %s', async (_name, invalidate) => {
    const { fetches, fetcher } = counter()
    await prefetchAsyncCache('invalidated', 'wallet', fetcher)
    invalidate()

    useAsyncWithCache('invalidated', 'wallet', fetcher, 0, { staleTimeMs })
    await flushPromises()

    expect(fetches()).toBe(2)
  })

  it('still refetches a fresh entry through refreshActiveAsyncCaches', async () => {
    const { fetches, fetcher } = counter()
    await prefetchAsyncCache('active', 'wallet', fetcher)
    useAsyncWithCache('active', 'wallet', fetcher, 0, { staleTimeMs })

    await refreshActiveAsyncCaches()

    expect(fetches()).toBe(2)
  })

  it('keeps polling on the refresh interval while the mount fetch is skipped', async () => {
    const { fetches, fetcher } = counter()
    await prefetchAsyncCache('polled', 'wallet', fetcher)

    useAsyncWithCache('polled', 'wallet', fetcher, 0, { refreshIntervalMs: staleTimeMs, staleTimeMs })
    await flushPromises()
    expect(fetches()).toBe(1)

    vi.advanceTimersByTime(staleTimeMs)
    await flushPromises()
    expect(fetches()).toBe(2)
  })

  it('measures freshness from the latest polled result', async () => {
    const { fetches, fetcher } = counter()
    await prefetchAsyncCache('repolled', 'wallet', fetcher)
    useAsyncWithCache('repolled', 'wallet', fetcher, 0, { refreshIntervalMs: staleTimeMs, staleTimeMs })
    vi.advanceTimersByTime(staleTimeMs)
    await flushPromises()
    vi.advanceTimersByTime(staleTimeMs / 2)

    useAsyncWithCache('repolled', 'wallet', fetcher, 0, { refreshIntervalMs: staleTimeMs, staleTimeMs })
    await flushPromises()

    expect(fetches()).toBe(2)
  })
})

describe('background refresh failures', () => {
  it('tracks only active periodic queries and clears a failure after success', async () => {
    let failing = true
    let periodicFetches = 0
    let foregroundFetches = 0

    useAsyncWithCache(
      'periodic',
      'wallet',
      async () => {
        periodicFetches++
        if (failing) throw new Error('offline')
        return 42
      },
      0,
      { refreshIntervalMs: 1_000 }
    )
    useAsyncWithCache(
      'foreground',
      'wallet',
      async () => {
        foregroundFetches++
        throw new Error('offline')
      },
      0
    )
    await flushPromises()

    expect(periodicFetches).toBe(1)
    expect(foregroundFetches).toBe(1)
    expect(useAsyncRefreshFailures().failedCount).toBe(1)

    failing = false
    await useAsyncRefreshFailures().retryFailed()

    expect(periodicFetches).toBe(2)
    expect(foregroundFetches).toBe(1)
    expect(useAsyncRefreshFailures().failedCount).toBe(0)
  })

  it('keeps a failed key failed when retry also fails', async () => {
    let fetches = 0
    useAsyncWithCache(
      'still-failed',
      'wallet',
      async () => {
        fetches++
        throw new Error('offline')
      },
      0,
      { refreshIntervalMs: 1_000 }
    )
    await flushPromises()

    await useAsyncRefreshFailures().retryFailed()

    expect(fetches).toBe(2)
    expect(useAsyncRefreshFailures().failedCount).toBe(1)
  })

  it('forgets a failure when the last periodic subscriber is cleaned up', async () => {
    useAsyncWithCache(
      'unmounted',
      'wallet',
      async () => Promise.reject(new Error('offline')),
      0,
      { refreshIntervalMs: 1_000 }
    )
    await flushPromises()
    expect(useAsyncRefreshFailures().failedCount).toBe(1)

    for (const cleanup of reactMock.cleanups.splice(0).reverse()) cleanup()

    expect(useAsyncRefreshFailures().failedCount).toBe(0)
  })
})

describe('setAsyncCache', () => {
  it('hands the written value to subscribers and serves it as fresh without fetching', async () => {
    let fetches = 0
    const fetcher = async (): Promise<number> => ++fetches
    useAsyncWithCache('written', 'wallet', fetcher, 0, { staleTimeMs: 60_000 })
    await flushPromises()
    reactMock.setState.mockClear()

    setAsyncCache('written', 'wallet', 42)

    expect(reactMock.setState).toHaveBeenCalledWith(42)
    await prefetchAsyncCache('written', 'wallet', fetcher)
    useAsyncWithCache('written', 'wallet', fetcher, 0, { staleTimeMs: 60_000 })
    await flushPromises()
    expect(fetches).toBe(1)
  })

  it('keeps the written value when a fetch started before the write resolves after it', async () => {
    let resolveFetch: (value: number) => void = () => {}
    const pending = new Promise<number>((resolve) => { resolveFetch = resolve })
    useAsyncWithCache('raced', 'wallet', () => pending, 0)

    setAsyncCache('raced', 'wallet', 42)
    reactMock.setState.mockClear()
    resolveFetch(7)
    await flushPromises()
    await flushPromises()

    expect(reactMock.setState).not.toHaveBeenCalledWith(7)
    expect(reactMock.setState).toHaveBeenCalledWith(42)
  })
})
