import {Wallet} from './Wallet'

export interface UnlockedWallet {
  wallet: Wallet
  seed: Uint8Array
}