import type { CoreRecipient, CoreSpendSource, Network, PlatformSpendSource, ShieldedSpendSource } from '../api/types'
import type { CoinControlFunds, CoinControlSelection } from './CoinControl'
import type { SendDraft } from './SendDraft'
import type { TransferOperation } from '../enums/TransferOperation'

export interface SendPreviewRow {
  address: string
  amountCredits: bigint | null
  reference?: string
  label?: string
}

export interface SendPreviewInputsParams {
  selection: CoinControlSelection
  funds: CoinControlFunds
  fixedAddress?: string
  fixedCredits?: bigint | null
  feeFromOutput?: boolean
}

export interface SendPreviewRowsProps {
  rows: SendPreviewRow[]
  isCoreOperation: boolean
}

export interface SendPreviewAmountProps {
  credits: bigint
  isCoreOperation: boolean
}

export interface SendPreviewOutputsParams {
  recipients: CoreRecipient[]
  feeCredits: bigint
  feeOutputIndex?: number
  newIdentity: boolean
}

export interface SendPreviewSourceParams {
  network: Network | null
  coreSource?: CoreSpendSource
  platformSource?: PlatformSpendSource | null
  shieldedSource?: ShieldedSpendSource
  fixedAddress?: string
  changeTo?: string
}

export interface SendPreviewChangeParams {
  operation: TransferOperation | null
  amountDuffs: bigint
  maxDuffs: bigint | null
  changeTo?: string
}

export interface SendTransactionPreviewData {
  title: string
  from: string
  isCoreOperation: boolean
  receivedIsEstimate: boolean
  amountCredits: bigint
  feeCredits: bigint
  totalDebitCredits: bigint
  inputs: SendPreviewRow[]
  outputs: SendPreviewRow[]
  inputNote: string | null
  outputNote: string | null
}

export interface SendTransactionReview {
  draft: SendDraft
  source: string
  feeCredits: bigint
  feeDuffs: bigint
  data: SendTransactionPreviewData
}

export interface SendTransactionPreviewProps {
  data: SendTransactionPreviewData
  valid: boolean
  canRefresh: boolean
  onBack: () => void
  onRetry: () => void
  onSign: () => void
}
