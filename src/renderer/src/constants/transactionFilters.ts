import { TxDirectionFilter } from '../enums/TxDirectionFilter'
import type { FilterOption, TransactionCardItem, TxFilter } from '../types/WalletTransaction'

export const DEFAULT_TX_FILTER: TxFilter = {
  direction: TxDirectionFilter.All,
  type: 'all',
  status: 'all',
  search: '',
}

export const DIRECTION_BY_FILTER: Record<Exclude<TxDirectionFilter, TxDirectionFilter.All>, TransactionCardItem['direction']> = {
  [TxDirectionFilter.Received]: 'in',
  [TxDirectionFilter.Sent]: 'out',
  [TxDirectionFilter.Unchanged]: 'neutral',
}

export const TX_DIRECTION_OPTIONS: FilterOption<TxFilter['direction']>[] = [
  { value: TxDirectionFilter.All, label: 'All' },
  { value: TxDirectionFilter.Received, label: 'Received' },
  { value: TxDirectionFilter.Sent, label: 'Sent' },
  { value: TxDirectionFilter.Unchanged, label: 'No change' },
]

export const TX_CORE_TYPE_OPTIONS: FilterOption<TxFilter['type']>[] = [
  { value: 'all', label: 'All' },
  { value: 'core:transfer', label: 'Core: Transfers' },
  { value: 'core:assetLock', label: 'Core: Asset locks' },
]

export const TX_STATUS_OPTIONS: FilterOption<TxFilter['status']>[] = [
  { value: 'all', label: 'All' },
  { value: 'success', label: 'Success' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
  { value: 'unknown', label: 'Status unavailable' },
]
