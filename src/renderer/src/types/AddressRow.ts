import type { ReactNode } from 'react'

export interface AddressRowProps {
  address: string
  amount: ReactNode
  fiatDuffs?: bigint | null
  leading?: ReactNode
  meta?: ReactNode
  explorerUrl?: string
  onQr?: () => void
  hidden?: boolean
}
