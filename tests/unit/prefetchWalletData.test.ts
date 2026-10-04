import {beforeEach, describe, expect, it, vi} from 'vitest'

const harness = vi.hoisted(() => ({
  deps: null as unknown[] | null,
  ref: null as {current: {walletId: string; revision: number} | null} | null,
  auth: {
    isAuthenticated: true,
    status: {selectedWalletId: 'wallet-1', walletDataRevision: 1},
  },
  prefetchIdentities: vi.fn(),
  prefetchAddresses: vi.fn(),
  refreshAddresses: vi.fn(),
  prefetchPlatformAddresses: vi.fn(),
  prefetchTransactions: vi.fn(),
  refreshTransactions: vi.fn(),
  prefetchBalance: vi.fn(),
  refreshBalance: vi.fn(),
}))

vi.mock('react', () => ({
  useEffect: (effect: () => void, deps: unknown[]) => {
    const same = harness.deps?.length === deps.length && harness.deps.every((value, i) => value === deps[i])
    if (same) return
    harness.deps = [...deps]
    effect()
  },
  useRef: <T,>(initial: T): {current: T} => {
    if (harness.ref == null) harness.ref = {current: initial as {walletId: string; revision: number} | null}
    return harness.ref as {current: T}
  },
}))
vi.mock('@renderer/contexts/AuthContext', () => ({useAuth: () => harness.auth}))
vi.mock('../../src/renderer/src/hooks/useIdentities', () => ({prefetchIdentities: harness.prefetchIdentities}))
vi.mock('../../src/renderer/src/hooks/useAdresses', () => ({
  prefetchAddresses: harness.prefetchAddresses,
  refreshAddresses: harness.refreshAddresses,
}))
vi.mock('../../src/renderer/src/hooks/usePlatformAddresses', () => ({prefetchPlatformAddresses: harness.prefetchPlatformAddresses}))
vi.mock('../../src/renderer/src/hooks/useWalletTransactions', () => ({
  prefetchTransactions: harness.prefetchTransactions,
  refreshTransactions: harness.refreshTransactions,
}))
vi.mock('../../src/renderer/src/hooks/useWalletBalance', () => ({
  prefetchBalance: harness.prefetchBalance,
  refreshBalance: harness.refreshBalance,
}))

import {usePrefetchWalletData} from '../../src/renderer/src/hooks/usePrefetchWalletData'

describe('wallet data prefetch', () => {
  beforeEach(() => {
    harness.deps = null
    harness.ref = null
    harness.auth.isAuthenticated = true
    harness.auth.status = {selectedWalletId: 'wallet-1', walletDataRevision: 1}
    vi.clearAllMocks()
  })

  it('prefetches on initial selection and refreshes only after a status revision changes', () => {
    usePrefetchWalletData()

    expect(harness.prefetchTransactions).toHaveBeenCalledWith('wallet-1')
    expect(harness.prefetchBalance).toHaveBeenCalledWith('wallet-1')
    expect(harness.prefetchAddresses).toHaveBeenCalledWith('wallet-1')
    expect(harness.prefetchPlatformAddresses).toHaveBeenCalledWith('wallet-1')
    expect(harness.prefetchIdentities).toHaveBeenCalledWith('wallet-1')

    usePrefetchWalletData()
    expect(harness.refreshTransactions).not.toHaveBeenCalled()
    expect(harness.refreshBalance).not.toHaveBeenCalled()
    expect(harness.refreshAddresses).not.toHaveBeenCalled()

    harness.auth.status = {selectedWalletId: 'wallet-1', walletDataRevision: 2}
    usePrefetchWalletData()

    expect(harness.refreshTransactions).toHaveBeenCalledOnce()
    expect(harness.refreshBalance).toHaveBeenCalledOnce()
    expect(harness.refreshAddresses).toHaveBeenCalledOnce()
    expect(harness.prefetchPlatformAddresses).toHaveBeenCalledOnce()
    expect(harness.prefetchIdentities).toHaveBeenCalledOnce()
  })
})
