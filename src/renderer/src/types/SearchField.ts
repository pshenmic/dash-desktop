import type { KeyboardEventHandler, Ref } from 'react'

export interface SearchFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  ariaLabel: string
  autoFocus?: boolean
  className?: string
  inputClassName?: string
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>
  ref?: Ref<HTMLInputElement>
}
