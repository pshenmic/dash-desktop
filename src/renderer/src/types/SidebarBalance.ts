export type SidebarBalanceVariant = 'total' | 'dash' | 'credits' | 'identities' | 'shielded'

export interface SidebarBalanceProps {
  variant: SidebarBalanceVariant
  balance?: bigint
  credits?: bigint
  isVisible: boolean
  fiat?: string
}
