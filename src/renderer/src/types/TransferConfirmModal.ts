import type { PlatformRecipient, PlatformSendResult } from '../api/types'
import type { TxSummaryProps } from './TxSummary'

export interface TransferConfirmModalProps {
  isOpen: boolean
  advanced?: boolean
  onClose: () => void
  title: string
  successTitle: string
  summary: TxSummaryProps
  recipients?: PlatformRecipient[]
  feeOutputIndex?: number
  feeCredits?: bigint | null
  run: (password: string) => Promise<PlatformSendResult>
  sourceValid?: boolean
  presetPassword?: string
  onSuccess: () => void
  successNote?: string
}
