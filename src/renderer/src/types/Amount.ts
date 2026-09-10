import type { ChangeEvent, ReactNode } from 'react'

export interface AmountFieldProps {
  value: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  onMax: () => void
  unit: ReactNode
  disabled?: boolean
  ariaLabel?: string
  maxLabel?: string
  maxDisabled?: boolean
}

export interface CreditsAmountProps {
  credits: bigint
  compact?: boolean
  exact?: boolean
  unit?: string | null
  showFiat?: boolean
  align?: 'start' | 'end' | 'center'
  amountClassName?: string
  unitClassName?: string
  className?: string
}
