import type { ReactNode } from 'react'
import type { PlatformAddressDto, SelectableUtxo, ShieldedNoteInfo, WalletAddressDto } from '../api/types'
import type { TransferOperation } from '../enums/TransferOperation'

export type CoinControlSelection =
  | { kind: 'automatic' }
  | { kind: 'coreAddress'; address: string }
  | { kind: 'coreOutpoints'; outpoints: string[] }
  | { kind: 'platformAddress'; address: string }
  | { kind: 'platformInputs'; inputs: Array<{address: string; credits: bigint}>; feeAddress: string }
  | { kind: 'shieldedAddress'; address: string }
  | { kind: 'shieldedNotes'; noteIndexes: number[] }

export interface CoinControlInventory {
  coreAddresses: string[]
  coreOutpoints: string[]
  platformBalances: Record<string, bigint>
  shieldedAddresses: string[]
  shieldedNoteIndexes: number[]
}

export interface CoinControlFunds {
  coreAddresses: WalletAddressDto[]
  utxos: SelectableUtxo[]
  platformAddresses: PlatformAddressDto[]
  shieldedNotes: ShieldedNoteInfo[]
}

export interface CoinControlTotals {
  count: number
  duffs: bigint
  credits: bigint
}

export interface CoinControlInputLabel {
  singular: string
  plural: string
}

export interface WalletUtxosResult {
  utxos: SelectableUtxo[]
  loading: boolean
  error: string | null
  retry: () => void
}

export interface CoinControlFixedSourceCopy {
  title: string
  description: string
}

export interface CoinControlModalProps {
  isOpen: boolean
  operation: TransferOperation | null
  selection: CoinControlSelection
  coreAddresses: WalletAddressDto[]
  coreAddressesLoading: boolean
  coreAddressesError: string | null
  onRetryCoreAddresses: () => void
  utxos: SelectableUtxo[]
  utxosLoading: boolean
  utxosError: string | null
  coreSyncIncomplete: boolean
  platformAddresses: PlatformAddressDto[]
  platformAddressesLoading: boolean
  platformAddressesError: string | null
  onRetryPlatformAddresses: () => void
  shieldedNotes: ShieldedNoteInfo[]
  identityLabel: string | null
  identityId: string | null
  platformAddress: PlatformAddressDto | undefined
  onRetryUtxos: () => void
  onClose: () => void
  onApply: (selection: CoinControlSelection) => void
}

export interface CoinControlEmptyProps {
  text: string
}

export interface CoinControlAddressValueProps {
  address: string
  detail: ReactNode
}

export interface CoinControlChoiceRowProps {
  checked: boolean
  onChange: () => void
  children: ReactNode
}

export interface CoinControlCheckRowProps {
  checked: boolean
  onChange: (checked: boolean) => void
  children: ReactNode
  disabled?: boolean
  bare?: boolean
}
