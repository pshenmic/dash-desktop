export interface DashscanPage<T> {
  resultSet: T[]
  pagination: {
    page: number
    limit: number
    // -1 when the result set is empty.
    total: number
  }
}

// No total: the cursor is the only position marker, and null ends the walk.
export interface DashscanCursorPage<T> {
  resultSet: T[]
  pagination: {
    limit: number
    nextCursor: string | null
  }
}

export interface DashscanVIn {
  prevTxHash: string | null
  vOutIndex: number | null
  address: string | null
  amount: string | null
  sequence: number | null
  scriptSigASM: string | null
}

export interface DashscanVOut {
  // Duffs. Documented as a string, served as a number.
  value: number | string | null
  number: number | null
  scriptPubKeyASM: string | null
  scriptPubKeyHex: string | null
  scriptPubKeyType: string | null
  address: string | null
  addresses: string[] | null
  spentTxId: string | null
  spentIndex: number | null
  spentHeight: number | null
}

export interface DashscanTransaction {
  hash: string
  type: string | null
  blockHeight: number | null
  blockHash: string | null
  timestamp: string | null
  amount: string | null
  version: number | null
  size: number | null
  vIn: DashscanVIn[] | null
  vOut: DashscanVOut[] | null
  confirmations: number | null
  instantLock: string | null
  chainLocked: boolean
  coinjoin: boolean
  multisig: boolean
}

export interface DashscanUTXO {
  prevTxHash: string | null
  vOutIndex: number | null
  address: string | null
  amount: string | null
  scriptPubKeyHex: string | null
  blockHeight: number | null
  confirmations: number | null
}

// Only the field we trust. The same response carries `received` and `sent`,
// which count every change output on both sides and so overstate both.
export interface DashscanXpubSummary {
  balance: string
}

export interface DashscanXpubAddress {
  address: string
  // 0 external (receive), 1 internal (change).
  branch: number
  index: number
  used: boolean
}

export interface DashscanAddressInfo {
  address: string
  balance: string
  txCount: number
}
// The HTTP status rides along so a caller can tell "the indexer has not seen
// this" from "the indexer did not answer" without matching on message text.
// Null when the request never produced a response at all.
export interface DashscanRequestError extends Error {
  status: number | null
}
