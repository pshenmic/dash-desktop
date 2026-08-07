import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const reactMock = vi.hoisted(() => ({
  cleanups: [] as Array<() => void>
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
    useState: <T>(initial: T) => [initial, vi.fn()],
    useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot()
  }
})

import {
  invalidateAllAsyncCaches,
  prefetchAsyncCache,
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
})

afterEach(() => {
  for (const cleanup of reactMock.cleanups.splice(0).reverse()) cleanup()
  invalidateAllAsyncCaches()
  vi.useRealTimers()
  vi.restoreAllMocks()
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
