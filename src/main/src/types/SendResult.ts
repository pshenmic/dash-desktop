// amount is what every recipient was paid together. No single toAddress: one
// transaction pays many, and naming the first would be a false summary of the
// rest.
export interface SendResult {
  txid: string
  amount: bigint
  fee: bigint
  changeAddress: string | null
  peersAcked: number
}
