import type { Network } from '../api/types'
import type { DestinationKind } from '../enums/DestinationKind'
import type { TransferOperation } from '../enums/TransferOperation'
import type { SendRecipientDraft } from './SendDraft'
import type { TransferPageType } from '../constants'
import type { ReactNode } from 'react'
import type { DropdownFieldOption, DropdownTextSize } from './DropdownField'
import type { PlatformAddressDto, ShieldedNoteInfo, WalletAddressDto } from '../api/types'
import type { IdentityApiDto } from '../hooks/useIdentities'

export interface OwnRecipientInventory {
  receiving: WalletAddressDto[]
  change: WalletAddressDto[]
  platformAddresses: PlatformAddressDto[]
  shieldedAddresses: string[]
  shieldedNotes: ShieldedNoteInfo[] | null
  identities: IdentityApiDto[]
}

export type RecipientInputAppearance = 'default' | 'subtle'

export interface RecipientFieldStyle {
  field: string
  textSize: DropdownTextSize
  searchIconSize: number
}

export interface RecipientInputProps {
  value: string
  onChange: (value: string) => void
  data: TransferPageType['recipient']
  compact?: boolean
  appearance?: RecipientInputAppearance
  ariaLabel?: string
  validate?: (value: string) => boolean
  invalid?: boolean
  valueAvatar?: boolean
  ownOptions?: DropdownFieldOption[]
  ownHeading?: string
  ownOptionsLoading?: boolean
  ownOptionsError?: string | null
  onRetryOwnOptions?: () => void
  ownedAddresses?: ReadonlySet<string>
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
  footer?: ReactNode
  recipients: SendRecipientDraft[]
  errors: SendRecipientError[]
  limit: number
  destination: DestinationKind
  budgetDuffs: bigint | null
  feeRecipientId: string | null
  feeCredits: bigint | null
  budgetIsEstimate: boolean
  amountDenominations?: readonly bigint[]
  ownOptions?: DropdownFieldOption[]
  ownHeading?: string
  ownedAddresses?: ReadonlySet<string>
  onChange: (recipients: SendRecipientDraft[]) => void
}
