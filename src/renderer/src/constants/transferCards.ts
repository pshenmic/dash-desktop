import type {CSSProperties} from 'react'

export const TRANSFER_CARD_PATH = 'M24 0H646Q670 0 670 24V104Q670 128 646 128H24Q0 128 0 104V24Q0 0 24 0Z'

export const TRANSFER_FROM_BORDER_PATH = 'M455 128H646Q670 128 670 104V24Q670 0 646 0H24Q0 0 0 24V104Q0 128 24 128H215'

export const TRANSFER_TO_BORDER_PATH = 'M646 0Q670 0 670 24V104Q670 128 646 128H24Q0 128 0 104V24Q0 0 24 0'

export const TRANSFER_PROTRUSION_BORDER_PATH = 'M455 0Q397 0 367 15Q335 31 303 15Q273 0 215 0'

export const TRANSFER_PROTRUSION_PATH = `${TRANSFER_PROTRUSION_BORDER_PATH}Z`

export const TRANSFER_TO_MASK_STYLE: CSSProperties = {
  maskImage: `linear-gradient(#000, #000), url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 670 32" preserveAspectRatio="none"><path d="${TRANSFER_PROTRUSION_PATH}"/></svg>`)}")`,
  maskSize: '100% 100%, 100% 2rem',
  maskPosition: '0 0, 0 0',
  maskRepeat: 'no-repeat',
  maskComposite: 'exclude',
}
