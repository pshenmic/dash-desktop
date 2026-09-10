import type { ReactNode } from 'react'
import type { TransferOperation } from '../enums/TransferOperation'
import type { AdvancedSendRoute } from './SendDraft'

export interface TransactionSummaryProps {
  children: ReactNode
  operation: TransferOperation | null
  isCoreOperation: boolean
  amountDuffs: bigint
  maxAmountDuffs: bigint | null
  fee: {
    credits: bigint | null
    totalDuffs: bigint
    ready: boolean
    loading: boolean
    error: string | null
  }
  route: AdvancedSendRoute
  hasManualPlatformInputs: boolean
  amountError: string | null
  canSubmit: boolean
  onRouteChange: (update: Partial<AdvancedSendRoute>) => void
  onCoinControl: () => void
  onRetryFee: () => void
  onReview: () => void
}
