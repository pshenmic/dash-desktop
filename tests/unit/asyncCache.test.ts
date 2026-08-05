import { describe, it, expect } from 'vitest'
import { invalidateNamespaces, prefetchAsyncCache } from '../../src/renderer/src/hooks/useAsyncWithCache'

describe('invalidateNamespaces', () => {
  it('clears matching namespaces and leaves others cached', async () => {
    await prefetchAsyncCache('balance', 'w1', () => Promise.resolve(1))
    await prefetchAsyncCache('identities', 'w1', () => Promise.resolve(2))

    invalidateNamespaces(['balance'])

    let balanceFetches = 0
    let identitiesFetches = 0
    await prefetchAsyncCache('balance', 'w1', () => {
      balanceFetches++
      return Promise.resolve(3)
    })
    await prefetchAsyncCache('identities', 'w1', () => {
      identitiesFetches++
      return Promise.resolve(4)
    })

    expect(balanceFetches).toBe(1)
    expect(identitiesFetches).toBe(0)
  })

  it('drops a fetch that started before invalidation and resolved after it', async () => {
    let resolveStale: (value: number) => void = () => {}
    const stale = new Promise<number>((resolve) => {
      resolveStale = resolve
    })

    const started = prefetchAsyncCache('balance', 'w2', () => stale)
    invalidateNamespaces(['balance'])
    resolveStale(1)
    await started

    let fetches = 0
    await prefetchAsyncCache('balance', 'w2', () => {
      fetches++
      return Promise.resolve(2)
    })

    expect(fetches).toBe(1)
  })
})
