import type { CoreRecipient, CoreSpendSource, Network } from '../api/types'
import type { TxSummaryEndpoint } from './TxSummary'

export interface SendConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  walletId: string | null
  network: Network | null
  recipients: CoreRecipient[]
  advanced?: boolean
  from: TxSummaryEndpoint
  feeDuffs?: bigint | null
  source?: CoreSpendSource
  changeTo?: string
  sourceValid?: boolean
  presetPassword?: string
  onSuccess: () => void
}
