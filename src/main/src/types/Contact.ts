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
