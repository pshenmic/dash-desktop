import { HIGHLIGHTED_IDENTIFIER_CLASS } from './identifier'
import { POPOVER, POPOVER_OPTION } from './surfaces'

export const ADDRESS_SELECT_TRIGGER = 'w-max dash-block rounded-[.875rem] px-4 py-3.5 flex items-center justify-between gap-3 cursor-pointer hover:opacity-90 transition-opacity'

export const ADDRESS_SELECT_MENU = `absolute left-0 top-[calc(100%+.375rem)] z-30 w-max min-w-full max-h-60 overflow-y-auto ${POPOVER}`

export const ADDRESS_SELECT_OPTION = `w-full flex items-center gap-2.5 text-left ${POPOVER_OPTION}`

export const ADDRESS_SELECT_IDENTIFIER_CLASS = `whitespace-nowrap font-medium! ${HIGHLIGHTED_IDENTIFIER_CLASS}`

export const ADDRESS_SELECT_WRAPPING_IDENTIFIER_CLASS = `min-w-0 text-left font-medium! ${HIGHLIGHTED_IDENTIFIER_CLASS}`

export const ADDRESS_SELECT_SHRINKING = 'min-w-0 max-w-full'
