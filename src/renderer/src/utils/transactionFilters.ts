import { TxDirectionFilter } from '../enums/TxDirectionFilter'
import { TxTypeFilter } from '../enums/TxTypeFilter'
import { DIRECTION_BY_FILTER, TX_CORE_TYPE_OPTIONS } from '../constants/transactionFilters'
import type { PlatformTransaction } from '../api/types'
import type { FilterOption, TxFilter, TxTotals, WalletHistoryItem, WalletTxItem } from '../types/WalletTransaction'
import { duffsToCredits } from './balance'
import { platformTransactionTitle } from './platformTransactions'

export function isDefaultTxFilter(filter: TxFilter): boolean {
  return filter.direction === TxDirectionFilter.All && filter.type === 'all' && filter.status === 'all' && filter.search.trim() === ''
}

export function txType(tx: Pick<WalletTxItem, 'vout'>): Exclude<TxTypeFilter, TxTypeFilter.All> {
  return tx.vout.some((output) => !output.address) ? TxTypeFilter.AssetLock : TxTypeFilter.Transfer
}

export function transactionTypeOptions(transactions: PlatformTransaction[]): FilterOption<TxFilter['type']>[] {
  return [
    ...TX_CORE_TYPE_OPTIONS,
    ...Array.from(new Set(transactions.map((tx) => tx.type))).sort()
      .map((type) => ({ value: `platform:${type}` as const, label: `Platform: ${platformTransactionTitle(type)}` })),
  ]
}

export function matchesTxFilter(tx: WalletHistoryItem, filter: TxFilter): boolean {
  if (filter.direction !== TxDirectionFilter.All && tx.direction !== DIRECTION_BY_FILTER[filter.direction]) return false
  if (filter.type !== 'all' && tx.type !== filter.type) return false
  if (filter.status !== 'all' && tx.status !== filter.status) return false
  const search = filter.search.trim().toLowerCase()
  return !search || tx.searchValues.some((value) => value?.toLowerCase().includes(search))
}

export function filterTransactions(transactions: WalletHistoryItem[], filter: TxFilter): WalletHistoryItem[] {
  return transactions.filter((tx) => matchesTxFilter(tx, filter))
}

export function computeTxTotals(transactions: WalletHistoryItem[]): TxTotals {
  const totals: TxTotals = { receivedCredits: 0n, sentCredits: 0n }
  for (const tx of transactions) {
    if (tx.kind === 'core' && tx.status === 'failed') continue
    const credits = tx.kind === 'core' ? duffsToCredits(tx.amount) : tx.amount
    if (tx.direction === 'in') totals.receivedCredits += credits
    if (tx.direction === 'out') totals.sentCredits += credits
  }
  return totals
}
