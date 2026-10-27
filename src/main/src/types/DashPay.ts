import {Username} from './Username'

// A contactRequest document as Platform stores it.
export interface DashPayContactRequest {
  id: string
  ownerId: string
  toUserId: string
  senderKeyIndex: number
  recipientKeyIndex: number
  accountReference: number
  encryptedPublicKey: Uint8Array
  createdAt: number
  coreHeightCreatedAt: number
  // Ours only, on a request sent to us: encryptedPublicKey decrypted, or the
  // finding that it never can be.
  contactXpub: string | null
  paymentChannelBroken: boolean
}

export type DashPayContactRelationship = 'incoming' | 'outgoing' | 'established'

// One of our identities and another, by the latest request each way.
export interface DashPayContact {
  identifier: string
  contactId: string
  relationship: DashPayContactRelationship
  // The contact's DPNS names, oldest first.
  usernames: string[]
  // $createdAt of the latest request each way, null while that side has sent none.
  incomingCreatedAt: number | null
  outgoingCreatedAt: number | null
  // Their request can never be decrypted, so they cannot be paid until they send a new one.
  paymentChannelBroken: boolean
}

// `receiving` is our chain, which the contact pays; `external` is theirs, which we pay.
export type DashPayDirection = 'receiving' | 'external'

export interface DashPayAddress {
  direction: DashPayDirection
  index: number
  address: string
  derivationPath: string
  isUsed: boolean
}

// What one wallet's refreshDashPay fetched, held in memory only.
export interface DashPayWalletCache {
  // null until the wallet's first refresh in this process.
  usernames: Username[] | null
  requests: DashPayContactRequest[] | null
  // A contact's DPNS names, oldest first, by identifier.
  contactNames: Map<string, string[]>
  // Both chains of each friendship, keyed `${identifier}:${contactId}:${direction}`.
  chains: Map<string, DashPayAddress[]>
}

// One payment between us and a contact, from the side of our identity. date in milliseconds.
export interface DashPayPayment {
  txid: string
  amountDuffs: bigint
  direction: 'sent' | 'received'
  date: number
}
