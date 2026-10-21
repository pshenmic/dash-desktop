import {Network} from './Network'

export interface Contact {
  id: number
  label: string
  address: string
  network: Network
  createdAt: number
}

// A DashPay contactRequest document as Platform stores it.
export interface ContactRequest {
  id: string
  ownerId: string
  toUserId: string
  senderKeyIndex: number
  recipientKeyIndex: number
  accountReference: number
  encryptedPublicKey: Uint8Array
  createdAt: number
}

// One of our identities and another, by the latest request each way.
// Established once both are set.
export interface DashPayContact {
  identifier: string
  contactId: string
  sent: ContactRequest | null
  received: ContactRequest | null
}
