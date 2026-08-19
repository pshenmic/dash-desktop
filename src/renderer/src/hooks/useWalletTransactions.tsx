import { API } from '@renderer/api'
import { TransactionGroup, WalletTxDto, WalletTxItem } from '@renderer/types/WalletTransaction'
import { formatCreationDate } from '@renderer/utils/date'
import { mapWalletTransaction } from '@renderer/utils/walletTransactions'
import { invalidateAsyncCache, prefetchAsyncCache, useAsyncWithCache } from './useAsyncWithCache'

export type { WalletTxDto, WalletTxItem } from '@renderer/types/WalletTransaction'

function groupTransactionsByDay(items: WalletTxItem[]) {
  const map = new Map<string, WalletTxItem[]>()
  for (const tx of items) {
    const key = formatCreationDate(tx.date)
    const arr = map.get(key) ?? []
    arr.push(tx)
    map.set(key, arr)
  }
  return Array.from(map.entries()).map(([label, transactions]) => ({ date: label, transactions }))
}

const fetchTransactionGroups = (walletId: string): Promise<TransactionGroup[]> =>
  API.getTransactions(walletId)
    .then((raw) => groupTransactionsByDay((raw ?? []).map(mapWalletTransaction)))

export function useWalletTransactions(walletId: string | undefined) {
  const { data: groups, loading, err } = useAsyncWithCache<TransactionGroup[]>(
    'transactions',
    walletId,
    () => fetchTransactionGroups(walletId!),
    [],
    { errorMessage: 'Failed to load transactions' }
  )
  return { groups, loading, err }
}

export function prefetchTransactions(walletId: string): Promise<void> {
  return prefetchAsyncCache('transactions', walletId, () => fetchTransactionGroups(walletId))
}

export function refreshTransactions(walletId: string): Promise<void> {
  invalidateAsyncCache('transactions', walletId)
  return prefetchTransactions(walletId)
}
