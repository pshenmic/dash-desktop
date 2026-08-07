export interface SendResult {
  txid: string
  amount: bigint
  fee: bigint
  toAddress: string
  changeAddress: string | null
  peersAcked: number
}
