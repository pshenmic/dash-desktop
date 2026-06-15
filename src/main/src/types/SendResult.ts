export interface SendResult {
  txid: string
  amount: string
  fee: string
  toAddress: string
  changeAddress: string | null
  peersAcked: number
}
