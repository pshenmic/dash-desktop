import type { ReactNode } from 'react'

export type DropdownTextSize = 12 | 14

export interface DropdownFieldOption {
  value: string
  label: string
  suffix?: string
  description?: string
  metadata?: string[]
}

export interface DropdownFieldProps {
  options: DropdownFieldOption[]
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  triggerClassName: string
  textSize?: DropdownTextSize
  renderIcon?: (value: string) => ReactNode
  editable?: boolean
  placeholder?: string
  inputInvalid?: boolean
  inputSuffix?: ReactNode
  menuHeading?: string
  highlightValue?: boolean
  toggleIcon?: (open: boolean) => ReactNode
  onOpenChange?: (open: boolean) => void
  children?: ReactNode
}
