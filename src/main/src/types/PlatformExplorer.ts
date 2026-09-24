export interface PlatformExplorerPage<T> {
  resultSet: T[]
  pagination: {
    page: number | null
    limit: number | null
    total: number
  }
}

// One state transition as seen through a platform address. `amount` is the net
// credit movement across every requested address the transition touched, so the
// two addresses of an internal transfer cancel; `addressesCount` says how many
// of them it was, and the address fields are null past one.
export interface PlatformExplorerAddressTransition {
  hash: string
  index: number | null
  blockHash: string | null
  blockHeight: number | null
  type: string
  batchType: string | null
  timestamp: string | null
  gasUsed: number | null
  status: string | null
  error: string | null
  incoming: boolean | null
  amount: string | null
  base58Address: string | null
  bech32mAddress: string | null
  addressesCount: number | null
}

// The credit movements of one identity. Carries the amount the transition
// endpoint lacks, and lacks the block height and status it carries.
export interface PlatformExplorerTransfer {
  amount: string | null
  sender: string | null
  recipient: string | null
  timestamp: string | null
  txHash: string
  type: string
  blockHash: string | null
  gasUsed: number | null
}

export interface PlatformExplorerTransition {
  hash: string
  type: string
  timestamp: string | null
  blockHeight: number | null
  gasUsed: number | null
  status: string | null
  error: string | null
  data: string | null
}
