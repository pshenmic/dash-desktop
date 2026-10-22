export interface SidebarBalanceProps {
  variant: 'dash' | 'credits' | 'identities' | 'shielded'
  to: string
  balance?: bigint
  credits?: bigint
  isVisible: boolean
  fiat?: string
}
