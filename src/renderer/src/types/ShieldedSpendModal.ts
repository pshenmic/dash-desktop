import type { PlatformRecipient, ShieldedSpendState } from '../api/types'
import type { ShieldedSpendKind } from '../enums/ShieldedSpendKind'
import type { TxSummaryEndpoint } from './TxSummary'

export interface ShieldedSpendModalProps {
  isOpen: boolean
  advanced?: boolean
  onClose: () => void
  walletId: string | null
  title: string
  kind: ShieldedSpendKind
  from: TxSummaryEndpoint
  toValue: string
  amountCredits: bigint
  feeCredits: bigint | null
  recipients?: PlatformRecipient[]
  proverReady: boolean
  start: (password: string) => Promise<ShieldedSpendState>
  sourceValid?: boolean
  onSuccess: () => void
  successNote?: string
}
