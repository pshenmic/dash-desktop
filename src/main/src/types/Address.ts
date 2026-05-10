export interface Address {
  walletId: string
  accountId: number
  address: string
  derivationPath: string
  index: number
  isChange: boolean
  isUsed: boolean
  label: string | null
  balance?: bigint | null
  usdBalance?: string | null
}
