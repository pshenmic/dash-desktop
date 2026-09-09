import type { Network, OperationFee } from '../api/types'
import { AssetLockFundingKind } from '../enums/AssetLockFundingKind'
import { DestinationKind } from '../enums/DestinationKind'
import { TransferOperation } from '../enums/TransferOperation'

export const DESTINATION_PLACEHOLDERS: Record<DestinationKind, Record<Network, string>> = {
  [DestinationKind.CoreAddress]: {mainnet: 'X… (Dash address)', testnet: 'y… (Dash address)'},
  [DestinationKind.PlatformAddress]: {mainnet: 'dash1…', testnet: 'tdash1…'},
  [DestinationKind.Identity]: {mainnet: 'Identity identifier', testnet: 'Identity identifier'},
  [DestinationKind.Shielded]: {mainnet: 'shielded address', testnet: 'shielded address'},
  [DestinationKind.NewIdentity]: {mainnet: 'shielded address', testnet: 'shielded address'},
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

export const SHIELDED_DESTINATION_LABELS: Partial<Record<TransferOperation, string>> = {
  [TransferOperation.ShieldedTransfer]: 'To (shielded)',
  [TransferOperation.Unshield]: 'To (Platform)',
  [TransferOperation.IdentityCreateFromShielded]: 'Creates',
  [TransferOperation.ShieldedWithdrawal]: 'To (Core L1)',
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
    names: string
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
    placeholder: 'Enter address or search name',
    addressBook: 'Address Book',
    addressManagement: 'Address Management',
    names: 'Names',
    noResults: 'No addresses found',
  },
  amountSummary: {
    fees: 'Fees:',
    totalAmount: 'Total Amount:',
    button: 'Next',
  }
}
