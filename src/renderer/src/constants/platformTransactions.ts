import type { PlatformTransaction, WalletHistory } from '../api/types'
import type { FilterOption, PlatformTxFilter, TransactionCardItem } from '../types/WalletTransaction'

export const TRANSACTIONS_REFRESH_MS = 15_000

export const EMPTY_WALLET_HISTORY: WalletHistory = { core: [], platform: [], platformFailed: false }

export const PLATFORM_TX_STATUS_VARIANTS: Record<NonNullable<PlatformTransaction['status']> | 'unknown', 'default' | 'error' | 'muted'> = {
  SUCCESS: 'default',
  FAIL: 'error',
  unknown: 'muted',
}

export const PLATFORM_TX_CARD_STATUSES: Record<NonNullable<PlatformTransaction['status']> | 'unknown', TransactionCardItem['status']> = {
  SUCCESS: 'success',
  FAIL: 'failed',
  unknown: 'unknown',
}

export const DEFAULT_PLATFORM_TX_FILTER: PlatformTxFilter = {
  search: '',
  direction: 'all',
  type: 'all',
  status: 'all',
}

export const PLATFORM_TX_DIRECTION_OPTIONS: FilterOption<PlatformTxFilter['direction']>[] = [
  { value: 'all', label: 'All' },
  { value: 'increase', label: 'Received' },
  { value: 'decrease', label: 'Sent' },
  { value: 'unchanged', label: 'No change' },
]

export const PLATFORM_TX_STATUS_OPTIONS: FilterOption<PlatformTxFilter['status']>[] = [
  { value: 'all', label: 'All' },
  { value: 'SUCCESS', label: 'Success' },
  { value: 'FAIL', label: 'Failed' },
  { value: 'unknown', label: 'Status unavailable' },
]
