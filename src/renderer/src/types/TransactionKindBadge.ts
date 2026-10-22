import type { TransactionCardItem } from '@renderer/types/WalletTransaction'

export type TransactionKind = NonNullable<TransactionCardItem['kind']>

export interface TransactionKindBadge {
  text: string
  label: string
  className: string
}
