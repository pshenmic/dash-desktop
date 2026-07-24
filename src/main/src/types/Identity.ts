import {AmountWithUsd} from "./WalletBalance";

export interface Identity {
  walletId: string
  identityIndex: number
  derivationPath: string
  identifier: string
  assetLockTxid?: string | null
  isImported?: boolean
}

export interface IdentityInfo {
  identityIndex: number
  identifier: string
  alias: string | null
  balance: AmountWithUsd
  derivationPath: string
  assetLockTxid: string | null
  isImported: boolean
}
