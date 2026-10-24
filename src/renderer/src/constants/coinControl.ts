import { SourceKind } from '../enums/SourceKind'
import { TransferOperation } from '../enums/TransferOperation'
import type { CoinControlFixedSourceCopy, CoinControlInputLabel } from '../types/CoinControl'

export const COIN_CONTROL_INVALID_MESSAGE = 'Selected funds are no longer available. Review your coin control selection before continuing.'

export const COIN_CONTROL_LABELS = {
  automaticTitle: 'Let The Wallet Choose',
  automaticDescription: 'The wallet will select enough available inputs for the amount and fee',
  switchToManual: 'Switch to Manual',
  filterDust: 'Filter Dust',
  paysFee: 'Pays fee',
  feePayerGroup: 'Fee-paying input',
}

export const COIN_CONTROL_FIAT_CLASS = 'rounded-md dash-block-accent-12 px-2 py-[.3125rem] text-[.625rem] leading-none font-medium dash-text-primary whitespace-nowrap'

export const FEE_PAYER_KEY_STEPS: Partial<Record<string, number>> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
}

export const COIN_CONTROL_AUTOMATIC_RAYS_PATH = 'M280 110L-1200 -1000M320 90V-1000M360 110L1840 -1000M270 140H-1200M370 140H1840'

export const COIN_CONTROL_AUTOMATIC_ADDRESS_PLACEMENTS = [
  {x: -72, y: 22, width: 172, rotation: 6},
  {x: 4, y: 74, width: 172, rotation: -5},
  {x: 138, y: 6, width: 172, rotation: -4},
  {x: 368, y: 24, width: 172, rotation: 9},
  {x: 516, y: 2, width: 172, rotation: -3},
  {x: 564, y: 82, width: 172, rotation: -9},
] as const

export const COIN_CONTROL_AUTOMATIC_CHIP = {
  height: 20,
  radius: 8,
  fillOpacity: 0.06,
  arrowPath: 'M7.5 12.5L11.5 8.5M8.5 8.5H11.5V11.5',
  textX: 15,
  textY: 13,
  textOpacity: 0.5,
  iconSize: 8,
  iconRadius: 2,
  iconGap: 3,
  iconOpacity: 0.1,
  paddingEnd: 6,
  copyGlyphPath: 'M2 3H5V6H2ZM3 3V2H6V5H5',
  qrGlyphPath: 'M2 2H3.5V3.5H2ZM4.5 2H6V3.5H4.5ZM2 4.5H3.5V6H2ZM4.5 4.5H6V6H4.5Z',
  glyphOpacity: 0.5,
  strokeWidth: 0.5,
} as const

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
