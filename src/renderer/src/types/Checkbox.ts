import type { ReactNode } from 'react'

export type CheckboxAppearance = 'default' | 'subtle'

export interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
  className?: string
  disabled?: boolean
  appearance?: CheckboxAppearance
}
