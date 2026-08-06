export interface DashscanPage<T> {
  resultSet: T[]
  pagination: {
    page: number
    limit: number
    // -1 when the result set is empty.
    total: number
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

export interface DashscanAddressInfo {
  address: string
  balance: string
  txCount: number
}