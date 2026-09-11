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
  compact?: boolean
  caption?: ReactNode
}

export interface AmountSliderProps {
  percent: number
  onPercentChange: (percent: number) => void
  disabled?: boolean
  label?: string
  compact?: boolean
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
