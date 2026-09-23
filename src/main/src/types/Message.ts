// Signed on core, where a transaction is always one or the other. On platform a
// transition that nets to nothing still moved credits — an asset lock funding
// is the common one — so neither side can be claimed.
export type TransactionDirection = 'in' | 'out' | 'neutral'

export interface NewTransactionMessage {
  chain: 'core' | 'platform'
  walletId: string
  // A core txid or a state transition hash, never interchangeable.
  hash: string
  type: string
  direction: TransactionDirection
  // Duffs on core, credits on platform — amountType says which.
  amount: bigint
  amountType: 'duffs' | 'credits'
  // The ends this wallet was paid at on the way in, the ones it paid on the way
  // out. Null where the source named none.
  recipients: string[] | null
}

export interface MessageData {
  NewTransaction: NewTransactionMessage
}

export type MessageKind = keyof MessageData
export type MessagePayload<K extends MessageKind> = MessageData[K]

export interface Message<K extends MessageKind> {
  type: K
  data: MessagePayload<K>
}
