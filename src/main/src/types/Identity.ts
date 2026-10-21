import {AmountWithUsd} from "./WalletBalance";
import {IdentityKey} from "./IdentityKeys";

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
  keys: IdentityKey[]
  balance: AmountWithUsd
  derivationPath: string
  assetLockTxid: string | null
}
