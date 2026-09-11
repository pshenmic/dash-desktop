import type { CoreRecipient, CoreSpendSource, Network, PlatformSpendSource, PreviewEntry, PreviewParams, PreviewUnit, ShieldedSpendSource, TransactionPreview } from '../api/types'
import type { TransferOperation } from '../enums/TransferOperation'

export interface SendPreviewParams {
  operation: TransferOperation
  recipients: CoreRecipient[]
  coreSource?: CoreSpendSource
  platformSource?: PlatformSpendSource | null
  shieldedSource?: ShieldedSpendSource
  identityId?: string
  fromAddress?: string
  changeTo?: string
}

export interface SendPreviewRequest {
  id: number
  key: string
  walletId: string
  operation: TransferOperation
  params: PreviewParams
  from: string
}

export interface SendPreviewKeyParams {
  walletId: string | null
  network: Network | null
  operation: TransferOperation | null
  params: PreviewParams | null
}

export interface SendPreviewRow extends PreviewEntry {
  addressLabel: string
}

export interface SendPreviewOutputGroup {
  title: string | null
  rows: SendPreviewRow[]
}

export interface SendPreviewFee {
  label: string
  amount: bigint
  unit: PreviewUnit
}

export interface SendPreviewRowsProps {
  rows: SendPreviewRow[]
}

export interface SendPreviewAmountProps {
  amount: bigint
  unit: PreviewUnit
}

export interface SendTransactionPreviewData {
  title: string
  from: string
  isCoreOperation: boolean
  amountCredits: bigint
  totalDebitCredits: bigint
  feeDuffs: bigint | null
  feeCredits: bigint | null
  fees: SendPreviewFee[]
  inputs: SendPreviewRow[]
  outputGroups: SendPreviewOutputGroup[]
  unsignedHex: string | null
  unsignedLabel: string
}

export interface SendPreviewState {
  requestId: number | null
  loading: boolean
  error: string | null
  data: SendTransactionPreviewData | null
}

export type SendPreviewAction =
  | {type: 'start'; requestId: number}
  | {type: 'loaded'; requestId: number; data: SendTransactionPreviewData}
  | {type: 'failed'; requestId: number; error: string}
  | {type: 'reset'}

export interface SendPreviewMappingParams {
  preview: TransactionPreview
  operation: TransferOperation
  from: string
}

export interface SendTransactionPreviewProps {
  data: SendTransactionPreviewData | null
  loading: boolean
  error: string | null
  valid: boolean
  canRefresh: boolean
  onBack: () => void
  onRetry: () => void
  onSign: () => void
}
