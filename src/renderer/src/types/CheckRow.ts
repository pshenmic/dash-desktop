import type { ReactNode } from 'react'

export interface CheckRowProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  children: ReactNode
  below?: ReactNode
  title?: string
  disabled?: boolean
}
