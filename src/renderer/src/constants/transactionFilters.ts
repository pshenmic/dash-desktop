import { TxBalanceChangeFilter } from '../enums/TxBalanceChangeFilter'
import type { FilterOption, TransactionCardItem, TxFilter } from '../types/WalletTransaction'

export const DEFAULT_TX_FILTER: TxFilter = {
  source: 'all',
  balanceChange: TxBalanceChangeFilter.All,
  type: 'all',
  status: 'all',
  search: '',
}

export const BALANCE_CHANGE_BY_DIRECTION: Record<TransactionCardItem['direction'], TxBalanceChangeFilter> = {
  in: TxBalanceChangeFilter.Increase,
  out: TxBalanceChangeFilter.Decrease,
  neutral: TxBalanceChangeFilter.Unchanged,
}

export const TX_SOURCE_OPTIONS: FilterOption<TxFilter['source']>[] = [
  { value: 'all', label: 'All' },
  { value: 'core', label: 'Core (L1)' },
  { value: 'platform', label: 'Evo (L2)' },
]

export const TX_BALANCE_CHANGE_OPTIONS: FilterOption<TxFilter['balanceChange']>[] = [
  { value: TxBalanceChangeFilter.All, label: 'All' },
  { value: TxBalanceChangeFilter.Increase, label: 'Increase' },
  { value: TxBalanceChangeFilter.Decrease, label: 'Decrease' },
  { value: TxBalanceChangeFilter.Unchanged, label: 'No change' },
]

export const TX_FILTER_LABELS: Record<keyof TxFilter, string> = {
  search: 'Search',
  source: 'Chain',
  balanceChange: 'Balance change',
  type: 'Type',
  status: 'Status',
}

export const TX_FILTER_CHIP_FIELDS: Array<Exclude<keyof TxFilter, 'search'>> = [
  'source', 'balanceChange', 'type', 'status',
]

export const TX_CORE_TYPE_OPTIONS: FilterOption<TxFilter['type']>[] = [
  { value: 'all', label: 'All' },
  { value: 'core:transfer', label: 'L1: Transfers' },
  { value: 'core:assetLock', label: 'L1: Asset locks' },
]

export const TX_STATUS_OPTIONS: FilterOption<TxFilter['status']>[] = [
  { value: 'all', label: 'All' },
  { value: 'success', label: 'Success' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
  { value: 'unknown', label: 'Status unavailable' },
]
