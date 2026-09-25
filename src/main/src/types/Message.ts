export interface NewTransactionMessage {
  chain: 'core' | 'platform'
  walletId: string
  hash: string
  type: string
  netAmount: bigint
  amount: bigint
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
