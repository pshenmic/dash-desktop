import {AmountWithUsd} from "./WalletBalance";

export interface Identity {
  walletId: string
  identityIndex: number
  derivationPath: string
  identifier: string
  assetLockTxid?: string | null
}

export interface IdentityInfo {
  identityIndex: number
  identifier: string
  // The oldest of aliasesList, which is the one shown.
  alias: string | null
  // Every DPNS name the identity owns on Platform, oldest first.
  aliasesList: string[]
  balance: AmountWithUsd
  derivationPath: string
  assetLockTxid: string | null
}
