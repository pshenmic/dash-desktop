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
}

export type DashPayContactRelationship = 'incoming' | 'outgoing' | 'established'

// One of our identities and another, by the latest request each way.
export interface DashPayContact {
  identifier: string
  contactId: string
  relationship: DashPayContactRelationship
  // The contact's DPNS names, oldest first.
  aliasesList: string[]
  // $createdAt of the latest request each way, null while that side has sent none.
  incomingCreatedAt: number | null
  outgoingCreatedAt: number | null
}
