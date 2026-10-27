import type {CSSProperties} from 'react'

export const TRANSFER_CARD_GEOMETRY = {
  radius: 24,
  notchHalfWidth: 120,
  notchDepth: 22,
  notchEdgeHandle: 60,
  notchBottomHandle: 40,
  strokeInset: 0.5,
}

export const TRANSFER_TO_MASK_LAYOUT: CSSProperties = {
  maskPosition: '0 0, 50% 0',
  maskRepeat: 'no-repeat',
  maskComposite: 'exclude',
}
