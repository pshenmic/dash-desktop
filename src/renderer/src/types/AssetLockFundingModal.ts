import type { AssetLockFundingKind, CoreSpendSource } from '../api/types'
import type { TxSummaryEndpoint } from './TxSummary'

interface AssetLockFundingModalBaseProps {
  isOpen: boolean
  advanced?: boolean
  onClose: () => void
  walletId: string | null
  toPlatformAddress: string
  from?: TxSummaryEndpoint
  kind: AssetLockFundingKind
  sourceValid?: boolean
  onSuccess: () => void
}

export interface AssetLockFundingResumeModalProps extends AssetLockFundingModalBaseProps {
  resume: true
  amountDuffs: bigint | null
}

export interface AssetLockFundingStartModalProps extends AssetLockFundingModalBaseProps {
  resume: false
  amountDuffs: bigint
  feeDuffs: bigint | null
  feeCredits: bigint | null
  from: TxSummaryEndpoint
  source?: CoreSpendSource
}

export type AssetLockFundingModalProps = AssetLockFundingResumeModalProps | AssetLockFundingStartModalProps
