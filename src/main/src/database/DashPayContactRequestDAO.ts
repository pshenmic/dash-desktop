import type {Knex} from 'knex'
import {INSERT_CHUNK_SIZE} from '../constants/database'
import {DashPayContactRequest} from '../types/DashPay'
import {chunk} from '../utils/chunk'

function fromRow(row): DashPayContactRequest {
  return {
    id: row.document_id,
    ownerId: row.owner_id,
    toUserId: row.to_user_id,
    senderKeyIndex: row.sender_key_index,
    recipientKeyIndex: row.recipient_key_index,
    accountReference: row.account_reference,
    encryptedPublicKey: row.encrypted_public_key,
    createdAt: row.created_at,
    coreHeightCreatedAt: row.core_height_created_at,
    contactXpub: row.contact_xpub,
    paymentChannelBroken: Boolean(row.payment_channel_broken),
  }
}

export class DashPayContactRequestDAO {
  knex: Knex

  constructor(knex: Knex) {
    this.knex = knex
  }

  getContactRequests = async (walletId: string): Promise<DashPayContactRequest[]> => {
    const rows = await this.knex('dashpay_contact_requests')
      .select('*')
      .where('wallet_id', walletId)
      .orderBy('created_at', 'asc')
    return rows.map(fromRow)
  }

  setContactXpub = async (walletId: string, documentId: string, contactXpub: string): Promise<void> => {
    await this.knex('dashpay_contact_requests')
      .where({wallet_id: walletId, document_id: documentId})
      .update({contact_xpub: contactXpub})
  }

  setPaymentChannelBroken = async (walletId: string, documentId: string): Promise<void> => {
    await this.knex('dashpay_contact_requests')
      .where({wallet_id: walletId, document_id: documentId})
      .update({payment_channel_broken: true})
  }

  // A request never changes once written, so one already stored is skipped.
  saveAll = async (walletId: string, requests: DashPayContactRequest[]): Promise<void> => {
    for (const rows of chunk(requests, INSERT_CHUNK_SIZE)) {
      await this.knex('dashpay_contact_requests')
        .insert(rows.map(request => ({
          wallet_id: walletId,
          document_id: request.id,
          owner_id: request.ownerId,
          to_user_id: request.toUserId,
          sender_key_index: request.senderKeyIndex,
          recipient_key_index: request.recipientKeyIndex,
          account_reference: request.accountReference,
          encrypted_public_key: Buffer.from(request.encryptedPublicKey),
          created_at: request.createdAt,
          core_height_created_at: request.coreHeightCreatedAt,
          contact_xpub: request.contactXpub,
          payment_channel_broken: request.paymentChannelBroken,
        })))
        .onConflict(['wallet_id', 'document_id'])
        .ignore()
    }
  }
}
