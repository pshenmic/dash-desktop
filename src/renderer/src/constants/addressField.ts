import type { DropdownTextSize } from '../types/DropdownField'
import type { RecipientFieldStyle, RecipientInputAppearance } from '../types/SendRecipients'
import { HIGHLIGHTED_IDENTIFIER_CLASS } from './identifier'
import { FIELD_COMPACT } from './surfaces'

export const ADDRESS_INPUT = 'h-full w-full min-w-0 bg-transparent p-0 font-normal outline-none dash-text-default placeholder:text-current placeholder:opacity-40'

export const ADDRESS_INPUT_TEXT_SIZES: Record<DropdownTextSize, string> = {
  12: 'text-xs',
  14: 'text-sm',
}

export const ADDRESS_HIGHLIGHT_CLASSES: Record<DropdownTextSize, string> = {
  12: `min-w-0 flex-1 text-xs! ${HIGHLIGHTED_IDENTIFIER_CLASS}`,
  14: `min-w-0 flex-1 ${HIGHLIGHTED_IDENTIFIER_CLASS}`,
}

export const ADDRESS_AVATAR_SIZES: Record<DropdownTextSize, string> = {
  12: 'size-3 shrink-0',
  14: 'size-3.5 shrink-0',
}

export const FIELD_INVALID = 'outline outline-1 outline-dash-red'

export const FIELD_SUBTLE = 'min-h-[2.8125rem] rounded-[.875rem] border border-transparent dash-block-5 px-3 focus-within:border-dash-brand dark:focus-within:border-dash-mint'

export const RECIPIENT_FIELD_STYLES: Record<RecipientInputAppearance, RecipientFieldStyle> = {
  default: { field: FIELD_COMPACT, textSize: 14, searchIconSize: 18 },
  subtle: { field: FIELD_SUBTLE, textSize: 12, searchIconSize: 14 },
}

export const CONTACT_IDENTIFIER_CLASS = `min-w-0 font-medium! ${HIGHLIGHTED_IDENTIFIER_CLASS}`

