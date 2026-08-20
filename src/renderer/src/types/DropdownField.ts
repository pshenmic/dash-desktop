import type { ReactNode } from 'react'

export interface DropdownFieldOption {
  value: string
  label: string
}

export interface DropdownFieldProps {
  options: DropdownFieldOption[]
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  triggerClassName: string
  textSize?: 12 | 14
  renderIcon?: (value: string) => ReactNode
}
