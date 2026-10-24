import type { TransactionKind, TransactionKindBadge } from '@renderer/types/TransactionKindBadge'

export const TRANSACTION_KIND_BADGES: Record<TransactionKind, TransactionKindBadge> = {
  core: { text: 'core', label: 'Dash Core Chain', className: '' },
  platform: { text: 'evo', label: 'Dash Evo Chain', className: 'bg-violet-500/15! text-violet-700! dark:bg-violet-400/20! dark:text-violet-300!' },
}
