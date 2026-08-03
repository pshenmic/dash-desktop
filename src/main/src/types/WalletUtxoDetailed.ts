import {WalletSyncUtxo} from '../../p2p/types/walletSync'

export interface WalletUtxoDetailed extends WalletSyncUtxo {
  label: string | null
  blockTime: number
}
