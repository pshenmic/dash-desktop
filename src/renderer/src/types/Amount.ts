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
