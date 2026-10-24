import type { ReactNode } from 'react'

export interface TransactionDetailTokenProps {
  icon: ReactNode
  label: string
  hint?: string
  value: ReactNode
  subValue?: ReactNode
}
