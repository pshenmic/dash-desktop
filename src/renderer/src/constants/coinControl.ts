import { SourceKind } from '../enums/SourceKind'
import { TransferOperation } from '../enums/TransferOperation'
import type { CoinControlFixedSourceCopy, CoinControlInputLabel } from '../types/CoinControl'

export const COIN_CONTROL_INVALID_MESSAGE = 'Selected funds are no longer available. Review your coin control selection before continuing.'

export const FIXED_SOURCE_COPY: Partial<Record<TransferOperation, CoinControlFixedSourceCopy>> = {
  [TransferOperation.Shield]: {
    title: 'Selected Platform address',
    description: 'Shielding spends one source address as a single input. Change it in the From field.',
  },
  [TransferOperation.IdentityCreateFromShielded]: {
    title: 'Automatic shielded selection',
    description: 'Manual note selection is not available for identity creation from the shielded pool.',
  },
}

export const FIXED_IDENTITY_SOURCE_COPY: CoinControlFixedSourceCopy = {
  title: 'Selected identity',
  description: 'Identity operations spend the selected identity balance. Change it in the From field.',
}

export const INPUT_MODE_LABEL: Record<SourceKind, string> = {
  [SourceKind.Core]: 'UTXOs',
  [SourceKind.PlatformAddress]: 'Inputs',
  [SourceKind.Identity]: 'Inputs',
  [SourceKind.Shielded]: 'Notes',
}

export const INPUT_ITEM_LABELS: Record<SourceKind, CoinControlInputLabel> = {
  [SourceKind.Core]: {singular: 'UTXO', plural: 'UTXOs'},
  [SourceKind.PlatformAddress]: {singular: 'input', plural: 'inputs'},
  [SourceKind.Identity]: {singular: 'input', plural: 'inputs'},
  [SourceKind.Shielded]: {singular: 'note', plural: 'notes'},
}
