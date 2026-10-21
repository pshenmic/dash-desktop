import type { AssetLockFundingKind, CoreSpendSource } from '../api/types'
import type { AssetLockFundingPhase } from '../enums/AssetLockFundingPhase'
import type { TxSummaryEndpoint } from './TxSummary'

export interface AssetLockFundingPhaseLabel {
  key: AssetLockFundingPhase
  label: string
}

export interface AssetLockFundingTexts {
  title: string
  resumeTitle: string
  doneTitle: string
  doneHeading: string
  emptyTo: string
  confirm: string
}

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
