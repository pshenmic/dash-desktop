import type { Network } from '../api/types'
import type { DestinationKind } from '../enums/DestinationKind'
import type { TransferOperation } from '../enums/TransferOperation'
import type { SendRecipientDraft } from './SendDraft'
import type { TransferPageType } from '../constants'
import type { ReactNode } from 'react'
import type { DropdownFieldOption } from './DropdownField'
import type { PlatformAddressDto, WalletAddressDto } from '../api/types'
import type { IdentityApiDto } from '../hooks/useIdentities'

export interface OwnRecipientInventory {
  receiving: WalletAddressDto[]
  change: WalletAddressDto[]
  platformAddresses: PlatformAddressDto[]
  shieldedAddresses: string[]
  shieldedBalances: Map<string, bigint> | null
  identities: IdentityApiDto[]
}

export interface RecipientInputProps {
  value: string
  onChange: (value: string) => void
  data: TransferPageType['recipient']
  compact?: boolean
  ariaLabel?: string
  ownOptions?: DropdownFieldOption[]
}

export interface SendRecipientError {
  address: string | null
  amount: string | null
}

export interface SendRecipientValidation {
  recipients: SendRecipientDraft[]
  operation: TransferOperation | null
  destination: DestinationKind
  network: Network | null
  fundingAddresses: string[]
  feeRecipientId: string | null
  feeCredits: bigint | null
}

export interface SendRecipientsEditorProps {
  headerAction?: ReactNode
  beforeRecipients?: ReactNode
  recipients: SendRecipientDraft[]
  errors: SendRecipientError[]
  limit: number
  destination: DestinationKind
  budgetDuffs: bigint | null
  feeRecipientId: string | null
  feeCredits: bigint | null
  budgetIsEstimate: boolean
  onChange: (recipients: SendRecipientDraft[]) => void
}
