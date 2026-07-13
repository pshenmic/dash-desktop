import { Network } from './index'

export interface Wallet {
  walletId: string
  network: Network
  label: string | null
  encryptedMnemonic: string
  selected: boolean
  platformXpub: string | null
}
