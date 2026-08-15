import { Network } from './Network'

export interface Wallet {
  walletId: string
  network: Network
  label: string | null
  encryptedMnemonic: string
  selected: boolean
  platformXpub: string | null
  coreXpub: string | null
}
