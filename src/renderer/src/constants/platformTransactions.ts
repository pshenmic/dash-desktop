import type { PlatformTransaction, WalletHistory } from '../api/types'
import type { TransactionCardItem } from '../types/WalletTransaction'

export const TRANSACTIONS_REFRESH_MS = 60_000

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
