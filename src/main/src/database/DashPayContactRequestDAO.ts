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
        })))
        .onConflict(['wallet_id', 'document_id'])
        .ignore()
    }
  }
}
