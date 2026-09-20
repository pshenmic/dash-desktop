import type {PlatformTransaction, Transaction, TransactionInput, TransactionOutput} from '@renderer/api/types'
import type { TxFilter } from '@renderer/utils/transactionFilters'

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

export interface PlatformTransactionGroup {
  date: Date | null
  transactions: PlatformTransaction[]
}

export type TransactionsTab = 'core' | 'platform'

export type SelectedTransaction =
  | { kind: 'core'; transaction: WalletTxItem }
  | { kind: 'platform'; hash: string }

export interface PlatformTxFilter {
  search: string
  direction: 'all' | 'increase' | 'decrease' | 'unchanged'
  type: string
  status: 'all' | 'SUCCESS' | 'FAIL' | 'unknown'
}

export interface PlatformTxTotals {
  increase: bigint
  decrease: bigint
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

export type TransactionsFilterProps =
  | { kind: 'core'; filter: TxFilter; onChange: (filter: TxFilter) => void }
  | { kind: 'platform'; filter: PlatformTxFilter; onChange: (filter: PlatformTxFilter) => void; transactions: PlatformTransaction[] }

export interface TransactionsListProps {
  activeTab: TransactionsTab
  onTabChange: (tab: TransactionsTab) => void
  filter: TxFilter
  onFilterChange: (filter: TxFilter) => void
  platformFilter: PlatformTxFilter
  onPlatformFilterChange: (filter: PlatformTxFilter) => void
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
