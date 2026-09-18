import type {Knex} from 'knex'
import {PlatformTransaction, PlatformTxStatus} from '../types/PlatformTransaction'
import {INSERT_CHUNK_SIZE} from '../constants/database'
import {chunk} from '../utils/chunk'

const COLUMNS = [
  'wallet_id', 'hash', 'type', 'timestamp', 'block_height', 'status',
  'error', 'gas_credits', 'net_credits', 'subject', 'counterparty',
]

function fromRow({
  wallet_id, hash, type, timestamp, block_height, status, error, gas_credits, net_credits, subject, counterparty,
}): PlatformTransaction {
  return {
    walletId: wallet_id,
    hash,
    type,
    date: new Date(timestamp),
    blockHeight: block_height ?? null,
    status: (status ?? null) as PlatformTxStatus | null,
    error: error ?? null,
    gasCredits: BigInt(gas_credits),
    netCredits: BigInt(net_credits),
    subject: subject ?? null,
    counterparty: counterparty ?? null,
  }
}

// What the platform explorer has already told us about this wallet. Rows come
// back as the explorer reported them, one per source; mergePlatformTransactions
// is the only place a transition's sides become a single row.
export class PlatformTransactionDAO {
  knex: Knex

  constructor(knex: Knex) {
    this.knex = knex
  }

  getTransactions = async (walletId: string): Promise<PlatformTransaction[]> => {
    const rows = await this.knex('platform_transactions')
      .select(COLUMNS)
      .where('wallet_id', walletId)
      .orderBy('timestamp', 'desc')
    return rows.map(fromRow)
  }

  // Merge rather than ignore: a transition read again once its block was
  // indexed carries the height and status the first read was too early for.
  upsertTransactions = async (source: string, transactions: PlatformTransaction[]): Promise<void> => {
    for (const rows of chunk(transactions, INSERT_CHUNK_SIZE)) {
      await this.knex('platform_transactions')
        .insert(rows.map(transaction => ({
          wallet_id: transaction.walletId,
          hash: transaction.hash,
          source,
          type: transaction.type,
          timestamp: transaction.date.getTime(),
          block_height: transaction.blockHeight,
          status: transaction.status,
          error: transaction.error,
          gas_credits: transaction.gasCredits.toString(),
          net_credits: transaction.netCredits.toString(),
          subject: transaction.subject,
          counterparty: transaction.counterparty,
        })))
        .onConflict(['wallet_id', 'hash', 'source'])
        .merge()
    }
  }

  // Per source, because a hash one walk has reported says nothing about
  // whether the other has reached it yet.
  getKnownHashes = async (walletId: string, source: string): Promise<Set<string>> => {
    const rows = await this.knex('platform_transactions')
      .select('hash')
      .where({wallet_id: walletId, source})
    return new Set(rows.map(row => row.hash as string))
  }
}
