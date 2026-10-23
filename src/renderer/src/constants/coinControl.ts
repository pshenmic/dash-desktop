import { SourceKind } from '../enums/SourceKind'
import { TransferOperation } from '../enums/TransferOperation'
import type { CoinControlFixedSourceCopy, CoinControlInputLabel } from '../types/CoinControl'

export const COIN_CONTROL_INVALID_MESSAGE = 'Selected funds are no longer available. Review your coin control selection before continuing.'

export const COIN_CONTROL_AUTOMATIC_RAYS_PATH = 'M280 110L-1200 -1000M320 90V-1000M360 110L1840 -1000M270 140H-1200M370 140H1840'

export const COIN_CONTROL_AUTOMATIC_ADDRESS_PLACEMENTS = [
  {x: 10, y: 25, width: 130, rotation: 9},
  {x: 140, y: 65, width: 150, rotation: -8},
  {x: 405, y: 20, width: 155, rotation: -5},
  {x: 485, y: 70, width: 140, rotation: 10},
] as const

export const FIXED_SOURCE_COPY: Partial<Record<TransferOperation, CoinControlFixedSourceCopy>> = {
  [TransferOperation.Shield]: {
    title: 'Platform source',
    description: 'Shielding draws on your Platform addresses automatically, or only on the address picked in the From field.',
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

export const INPUT_ITEM_LABELS: Record<SourceKind, CoinControlInputLabel> = {
  [SourceKind.Core]: {singular: 'UTXO', plural: 'UTXOs'},
  [SourceKind.PlatformAddress]: {singular: 'input', plural: 'inputs'},
  [SourceKind.Identity]: {singular: 'input', plural: 'inputs'},
  [SourceKind.Shielded]: {singular: 'note', plural: 'notes'},
}
