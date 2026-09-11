import type { WalletAddressDto } from '../api/types'
import type { TransferOperation } from '../enums/TransferOperation'

export interface ChangeAddressFieldProps {
  change: WalletAddressDto[]
  value?: string
  loading: boolean
  error: string | null
  previewOnly: boolean
  onChange: (address: string) => void
  onRetry: () => void
}

export interface CoreSendChangeParams {
  advanced: boolean
  customChangeEnabled?: boolean
  operation: TransferOperation | null
  amountDuffs: bigint
  maxDuffs: bigint | null
  change: WalletAddressDto[]
  selected?: string
}
