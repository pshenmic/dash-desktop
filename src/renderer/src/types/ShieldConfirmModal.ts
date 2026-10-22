import type { PlatformSpendSource } from '../api/types'
import type { TxSummaryEndpoint } from './TxSummary'

export interface ShieldConfirmModalProps {
  isOpen: boolean
  advanced?: boolean
  onClose: () => void
  walletId: string | null
  source: PlatformSpendSource | null
  from: TxSummaryEndpoint
  toAddress: string
  amountCredits: bigint
  feeCredits: bigint | null
  totalCredits: bigint | null
  proverReady: boolean
  sourceValid?: boolean
  presetPassword?: string
  onSuccess: () => void
}
