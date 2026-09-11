import type { CoreRecipient, PlatformRecipient } from '@renderer/api/types'

export interface RecipientSummaryProps {
  recipients: CoreRecipient[] | PlatformRecipient[]
  feeOutputIndex?: number
  feeCredits?: bigint | null
}
