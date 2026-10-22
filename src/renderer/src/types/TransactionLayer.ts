import type { LayerBadgeProps } from '@renderer/types/LayerBadge'
import type { TransactionCardItem } from '@renderer/types/WalletTransaction'

export type TransactionKind = NonNullable<TransactionCardItem['kind']>

export interface TransactionLayer {
  layer: LayerBadgeProps['layer']
  label: string
}
