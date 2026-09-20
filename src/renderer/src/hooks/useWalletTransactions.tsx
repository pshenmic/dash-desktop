import { API } from '@renderer/api'
import { useMemo } from 'react'
import type { WalletHistory } from '@renderer/api/types'
import { EMPTY_WALLET_HISTORY } from '@renderer/constants/platformTransactions'
import { groupTransactionsByDay, mapWalletTransaction } from '@renderer/utils/walletTransactions'
import { invalidateAsyncCache, prefetchAsyncCache, useAsyncWithCache } from './useAsyncWithCache'

export type { WalletTxDto, WalletTxItem } from '@renderer/types/WalletTransaction'

export function useWalletTransactions(walletId: string | undefined, refreshIntervalMs?: number) {
  const { data: history, loading, err } = useAsyncWithCache<WalletHistory>(
    'transactions',
    walletId,
    () => API.getTransactions(walletId!),
    EMPTY_WALLET_HISTORY,
    { errorMessage: 'Failed to load transactions', refreshIntervalMs }
  )
  const groups = useMemo(() => groupTransactionsByDay(history.core.map(mapWalletTransaction)), [history.core])
  return { groups, platform: history.platform, platformFailed: history.platformFailed, loading, err }
}

export function prefetchTransactions(walletId: string): Promise<void> {
  return prefetchAsyncCache('transactions', walletId, () => API.getTransactions(walletId))
}

export function refreshTransactions(walletId: string): Promise<void> {
  invalidateAsyncCache('transactions', walletId)
  return prefetchTransactions(walletId)
}
