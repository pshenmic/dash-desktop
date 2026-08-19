import type {Transaction, TransactionInput, TransactionOutput} from '@renderer/api/types'

export type WalletTxDto = Transaction

export type WalletTxStatus = 'success' | 'failed' | 'pending'

export type WalletTxItem = {
  id: string
  status: WalletTxStatus
  confirmations: number
  blockHeight: number | undefined
  size: number
  kind?: 'core'
  title: 'Send' | 'Receive'
  subtitleLabel: 'from' | 'to'
  labelValue: string
  amount: bigint
  usdAmount: string
  date: Date
  direction: 'in' | 'out'
  vin: TransactionInput[]
  vout: TransactionOutput[]
}

export type TransactionGroup = {
  date: string
  transactions: WalletTxItem[]
}
