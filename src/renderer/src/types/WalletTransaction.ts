import type {PlatformTransaction, Transaction, TransactionInput, TransactionOutput} from '@renderer/api/types'
import type { TxDirectionFilter } from '@renderer/enums/TxDirectionFilter'
import type { TxTypeFilter } from '@renderer/enums/TxTypeFilter'

export type WalletTxDto = Transaction

export type WalletTxStatus = 'success' | 'failed' | 'pending'

export type WalletTxItem = {
  id: string
  status: WalletTxStatus
  confirmations: number
  blockHeight: number | undefined
  size: number
  kind?: 'core'
  title: 'Send' | 'Receive'
  subtitleLabel: 'from' | 'to'
  labelValue: string
  amount: bigint
  usdAmount: string
  date: Date
  direction: 'in' | 'out'
  vin: TransactionInput[]
  vout: TransactionOutput[]
}

export type TransactionGroup = {
  date: string
  transactions: WalletTxItem[]
}

export interface TransactionCardItem {
  id: string
  status: WalletTxStatus | 'unknown'
  kind?: 'core' | 'platform'
  title: string
  subtitleLabel: string
  labelValue: string
  amount: bigint
  date: Date | null
  direction: 'in' | 'out' | 'neutral'
}

export interface TransactionCardAmount {
  value: string
  duffs: bigint
}

export interface WalletHistoryGroup {
  date: Date | null
  transactions: WalletHistoryItem[]
}

export type HistoryTransactionType = `core:${Exclude<TxTypeFilter, TxTypeFilter.All>}` | `platform:${string}`

export interface WalletHistoryItem extends TransactionCardItem {
  kind: 'core' | 'platform'
  type: HistoryTransactionType
  selection: SelectedTransaction
  searchValues: Array<string | null | undefined>
}

export type SelectedTransaction =
  | { kind: 'core'; transaction: WalletTxItem }
  | { kind: 'platform'; hash: string }

export interface TxFilter {
  search: string
  direction: TxDirectionFilter
  type: 'all' | HistoryTransactionType
  status: 'all' | TransactionCardItem['status']
}

export interface TxTotals {
  receivedCredits: bigint
  sentCredits: bigint
}

export interface FilterOption<T extends string> {
  value: T
  label: string
}

export interface FilterSectionProps<T extends string> {
  label: string
  options: Array<FilterOption<T>>
  selected: T
  onSelect: (value: T) => void
}

export interface TransactionsFilterProps {
  filter: TxFilter
  onChange: (filter: TxFilter) => void
  transactions: PlatformTransaction[]
}

export interface TransactionsListProps {
  filter: TxFilter
  onFilterChange: (filter: TxFilter) => void
  onTransactionClick: (transaction: SelectedTransaction) => void
  groups: TransactionGroup[]
  platform: PlatformTransaction[]
  platformFailed: boolean
  loading: boolean
  err: string | null
}

export interface PlatformTransactionDetailProps {
  transaction: PlatformTransaction
  onBack: () => void
}
