import { useEffect, useRef } from 'react'
import { useAuth } from '@renderer/contexts/AuthContext'
import { prefetchIdentities } from './useIdentities'
import { prefetchAddresses, refreshAddresses } from './useAdresses'
import { prefetchPlatformAddresses } from './usePlatformAddresses'
import { prefetchTransactions, refreshTransactions } from './useWalletTransactions'
import { prefetchBalance, refreshBalance } from './useWalletBalance'

export function usePrefetchWalletData(enabled = true): void {
  const { isAuthenticated, status } = useAuth()
  const walletId = status?.selectedWalletId ?? null
  const walletDataRevision = status?.walletDataRevision ?? 0
  const lastLoaded = useRef<{walletId: string; revision: number} | null>(null)

  useEffect(() => {
    if (!enabled || !isAuthenticated || !walletId) {
      lastLoaded.current = null
      return
    }

    const previous = lastLoaded.current
    lastLoaded.current = {walletId, revision: walletDataRevision}
    if (previous == null || previous.walletId !== walletId) {
      prefetchTransactions(walletId)
      prefetchBalance(walletId)
      prefetchAddresses(walletId)
      prefetchPlatformAddresses(walletId)
      prefetchIdentities(walletId)
      return
    }
    if (previous.revision === walletDataRevision) return

    void Promise.all([
      refreshTransactions(walletId),
      refreshBalance(walletId),
      refreshAddresses(walletId),
    ])
  }, [enabled, isAuthenticated, walletId, walletDataRevision])
}
