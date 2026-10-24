import { CHIP_VALUE } from './surfaces'

const MAX_CHIP_BEHAVIOUR = 'shrink-0 font-medium dash-text-primary cursor-pointer outline-none enabled:hover:dash-block-accent-10 focus-visible:ring-2 focus-visible:ring-dash-brand/40 dark:focus-visible:ring-dash-mint/40 disabled:cursor-default disabled:opacity-50'

export const MAX_CHIP_CLASS = `${CHIP_VALUE} ${MAX_CHIP_BEHAVIOUR}`

export const ALLOCATION_MAX_CHIP_CLASS = `rounded-md dash-block-accent-5 px-2 py-[.3125rem] text-[.625rem] leading-none ${MAX_CHIP_BEHAVIOUR}`

export const ALLOCATION_MAX_LABEL = 'Max'

export const ALLOCATION_EMPTY_VALUE = '0'

export const ALLOCATION_UNDERLINE = 'flex items-center gap-2 rounded-b-lg border-b px-2 py-1'
