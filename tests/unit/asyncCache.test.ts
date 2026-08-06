import { describe, expect, it } from 'vitest'
import { invalidateAllAsyncCaches, prefetchAsyncCache } from '@renderer/hooks/useAsyncWithCache'

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
})
