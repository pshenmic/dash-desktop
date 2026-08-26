export interface PlatformAddressRow {
  walletId: string
  index: number
  address: string
  derivationPath: string
  isUsed: boolean
}

export interface PlatformAddressEntry {
  platformAddress: string
  balanceCredits: bigint
  nonce: number
}
