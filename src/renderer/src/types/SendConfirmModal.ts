import type { CoreRecipient, CoreSpendSource, Network } from '../api/types'

export interface SendConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  walletId: string | null
  network: Network | null
  recipients: CoreRecipient[]
  advanced?: boolean
  amountFiat?: string
  feeDuffs?: bigint | null
  source?: CoreSpendSource
  changeTo?: string
  sourceValid?: boolean
  onSuccess: () => void
}
