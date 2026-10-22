import type { TransactionKind, TransactionLayer } from '@renderer/types/TransactionLayer'

export const TRANSACTION_KIND_LAYERS: Record<TransactionKind, TransactionLayer> = {
  core: { layer: 'L1', label: 'L1 Dash Core Chain' },
  platform: { layer: 'L2', label: 'L2 Dash Evo Chain' },
}
