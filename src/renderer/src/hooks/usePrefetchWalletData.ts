import { useEffect } from 'react'
import { useAuth } from '@renderer/contexts/AuthContext'
import { prefetchIdentities } from './useIdentities'
import { prefetchAddresses } from './useAdresses'
import { prefetchTransactions } from './useWalletTransactions'
import { prefetchBalance } from './useWalletBalance'

export function usePrefetchWalletData(): void {
  const { isAuthenticated, status } = useAuth()
  const walletId = status?.selectedWalletId ?? null

  useEffect(() => {
    if (!isAuthenticated || !walletId) return
    prefetchTransactions(walletId)
    prefetchBalance(walletId)
    prefetchAddresses(walletId)
    prefetchIdentities(walletId)
  }, [isAuthenticated, walletId])
}
