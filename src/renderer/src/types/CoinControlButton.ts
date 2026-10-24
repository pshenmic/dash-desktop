import type { ReactNode } from 'react'

export interface CoinControlButtonProps {
  label?: ReactNode
  summary: ReactNode
  onClick: () => void
}
