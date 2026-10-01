import type { PlatformSpendSource } from '../api/types'

export interface ShieldConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  walletId: string | null
  source: PlatformSpendSource | null
  fromDisplay: string
  toAddress: string
  amountCredits: string
  feeCredits: bigint | null
  proverReady: boolean
  sourceValid?: boolean
  onSuccess: () => void
}
