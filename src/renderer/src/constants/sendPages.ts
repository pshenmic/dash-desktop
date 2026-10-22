import type { Network, OperationFee } from '../api/types'
import type { EndpointLabel } from '../types/EndpointPicker'
import { AssetLockFundingKind } from '../enums/AssetLockFundingKind'
import { DestinationKind } from '../enums/DestinationKind'
import { SourceKind } from '../enums/SourceKind'
import { TransferOperation } from '../enums/TransferOperation'

export const SEND_ENDPOINT_LABELS: Partial<Record<`${SourceKind | DestinationKind}`, EndpointLabel>> = {
  [SourceKind.Core]: {name: 'Dash Core', layer: '(L1)'},
  [DestinationKind.CoreAddress]: {name: 'Dash Core', layer: '(L1)'},
  [SourceKind.PlatformAddress]: {name: 'Address', layer: '(L2)'},
}

const ADDRESS_PLACEHOLDER = 'Enter Address…'
const IDENTITY_PLACEHOLDER = 'Enter identity ID…'
const SHIELDED_PLACEHOLDER = 'Enter shielded address…'

export const DESTINATION_PLACEHOLDERS: Record<DestinationKind, Record<Network, string>> = {
  [DestinationKind.CoreAddress]: {mainnet: ADDRESS_PLACEHOLDER, testnet: ADDRESS_PLACEHOLDER},
  [DestinationKind.PlatformAddress]: {mainnet: ADDRESS_PLACEHOLDER, testnet: ADDRESS_PLACEHOLDER},
  [DestinationKind.Identity]: {mainnet: IDENTITY_PLACEHOLDER, testnet: IDENTITY_PLACEHOLDER},
  [DestinationKind.Shielded]: {mainnet: SHIELDED_PLACEHOLDER, testnet: SHIELDED_PLACEHOLDER},
  [DestinationKind.NewIdentity]: {mainnet: '', testnet: ''},
}

export const INVALID_DESTINATION_MESSAGES: Record<DestinationKind, string> = {
  [DestinationKind.CoreAddress]: 'Enter a valid Dash {network} address.',
  [DestinationKind.PlatformAddress]: 'Enter a valid Platform {network} address.',
  [DestinationKind.Identity]: 'Enter a valid identity identifier.',
  [DestinationKind.Shielded]: 'Enter a valid shielded address.',
  [DestinationKind.NewIdentity]: '',
}

export const UNFINISHED_FUNDING_LABELS: Record<AssetLockFundingKind, string> = {
  [AssetLockFundingKind.Address]: 'Unfinished Platform address funding',
  [AssetLockFundingKind.Shielded]: 'Unfinished L1 shielding',
  [AssetLockFundingKind.Identity]: 'Unfinished identity registration',
  [AssetLockFundingKind.IdentityTopUp]: 'Unfinished identity top-up',
}

export const OPERATION_FUNDING_KINDS: Partial<Record<TransferOperation, AssetLockFundingKind>> = {
  [TransferOperation.AssetLockFunding]: AssetLockFundingKind.Address,
  [TransferOperation.AssetLockShield]: AssetLockFundingKind.Shielded,
  [TransferOperation.IdentityRegister]: AssetLockFundingKind.Identity,
  [TransferOperation.IdentityTopUpL1]: AssetLockFundingKind.IdentityTopUp,
}

export interface TransferPageType {
  header: {
    title: string
    description: string
    balance: string
  }
  recipient: {
    label: string
    placeholder: string
    addressBook: string
    addressManagement: string
    noResults: string
  }
  amountSummary: {
    fees: string
    totalAmount: string
    button: string
  }
}

export const WITHDRAWAL_SUCCESS_NOTE = 'Withdrawals to Core chain are processed with a delay — the Dash payout usually takes several minutes, sometimes longer, to appear in your transaction list.'

export const SHIELDED_BALANCE_UNKNOWN_ERROR = 'Shielded balance is unknown — sync notes on the Shielded page before sending.'

export const TRANSITION_FEE_ERROR = 'Failed to estimate the network fee'

export const AUTOMATIC_PLATFORM_SELECTION = 'Automatic Platform selection'

export const AUTOMATIC_SOURCE_LABELS: Record<Exclude<SourceKind, SourceKind.Identity>, string> = {
  [SourceKind.Core]: 'Dash Core (L1)',
  [SourceKind.PlatformAddress]: AUTOMATIC_PLATFORM_SELECTION,
  [SourceKind.Shielded]: 'Your shielded balance',
}

// What an operation reads as before its fee is known.
export const NO_OPERATION_FEE: OperationFee = { feeCredits: null, feeDuffs: null, maxDuffs: null, maxPerTx: null, noteLimit: null }


export const sendPageData: TransferPageType = {
  header: {
    title: 'Send',
    description: 'Send Dash from this wallet. Enter a recipient address and amount, then carefully check the details before proceeding.',
    balance: 'Balance',
  },
  recipient: {
    label: 'Recipient',
    placeholder: ADDRESS_PLACEHOLDER,
    addressBook: 'Address Book',
    addressManagement: 'Address Management',
    noResults: 'No addresses found',
  },
  amountSummary: {
    fees: 'Fees:',
    totalAmount: 'Total Amount:',
    button: 'Next',
  }
}
