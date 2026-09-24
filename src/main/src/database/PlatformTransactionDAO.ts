import type {Knex} from 'knex'
import {PlatformTransaction, PlatformTxStatus} from '../types/PlatformTransaction'
import {INSERT_CHUNK_SIZE, LOCAL_SOURCE_PREFIX} from '../constants/database'
import {CREDITS_PER_DUFF} from '../constants/credits'
import {chunk} from '../utils/chunk'

function fromRow({
  wallet_id, hash, type, timestamp, block_height, status, error, gas_credits, net_credits, sender, recipient,
}, lockedCredits: bigint | null): PlatformTransaction {
  const net = BigInt(net_credits)
  const moved = net === 0n && lockedCredits != null ? lockedCredits : (net < 0n ? -net : net)

  return {
    walletId: wallet_id,
    hash,
    type,
    date: new Date(timestamp),
    blockHeight: block_height ?? null,
    status: (status ?? null) as PlatformTxStatus | null,
    error: error ?? null,
    gasCredits: BigInt(gas_credits),
    netCredits: net,
    amountCredits: moved,
    sender: sender == null ? [] : [{source: sender, amount: moved}],
    recipient: recipient == null ? [] : [{source: recipient, amount: moved}],
  }
}

export class PlatformTransactionDAO {
  knex: Knex

  constructor(knex: Knex) {
    this.knex = knex
  }

  getTransactions = async (walletId: string): Promise<PlatformTransaction[]> => {
    const [rows, fundings] = await Promise.all([
      this.knex('platform_transactions')
        .select('wallet_id', 'hash', 'type', 'timestamp', 'block_height', 'status',
          'error', 'gas_credits', 'net_credits', 'sender', 'recipient')
        .where('wallet_id', walletId)
        .orderBy('timestamp', 'desc'),
      this.knex('asset_lock_fundings')
        .select('st_hash', 'amount_duffs')
        .where('wallet_id', walletId)
        .whereNotNull('st_hash'),
    ])

    const locked = new Map(fundings.map(funding => [
      (funding.st_hash as string).toLowerCase(),
      BigInt(funding.amount_duffs as string) * CREDITS_PER_DUFF,
    ]))

    return rows.map(row => fromRow(row, locked.get((row.hash as string).toLowerCase()) ?? null))
  }

  // A transition read again once its block was indexed carries the height and
  // status the first read lacked. SQLite refuses a hash repeated in one upsert.
  upsertTransactions = async (source: string, transactions: PlatformTransaction[]): Promise<void> => {
    // dpp hashes a transition in lower case and the explorer answers in upper:
    // one case, or the row a send wrote is never the row a walk replaces.
    const unique = Array.from(new Map(transactions
      .map(row => [row.hash.toUpperCase(), {...row, hash: row.hash.toUpperCase()}] as const)).values())
    if (unique.length === 0) return

    for (const rows of chunk(unique, INSERT_CHUNK_SIZE)) {
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
          sender: transaction.sender[0]?.source ?? null,
          recipient: transaction.recipient[0]?.source ?? null,
        })))
        .onConflict(['wallet_id', 'hash', 'source'])
        .merge()
    }

    // What a send guessed about this end, now that the end itself has reported.
    if (source.startsWith(LOCAL_SOURCE_PREFIX)) return
    await this.knex('platform_transactions')
      .where({wallet_id: unique[0].walletId, source: `${LOCAL_SOURCE_PREFIX}${source}`})
      .whereIn('hash', unique.map(transaction => transaction.hash))
      .delete()
  }

  // A source naming an address set this wallet no longer asks about. Its rows
  // would fold in alongside the rows that replaced them.
  deleteRetiredSources = async (walletId: string, sources: string[]): Promise<void> => {
    await this.knex('platform_transactions')
      .where('wallet_id', walletId)
      .whereNotIn('source', sources)
      // A send's own rows answer to the end that replaces them: the address it
      // paid need not be one this wallet asks about.
      .whereNot('source', 'like', `${LOCAL_SOURCE_PREFIX}%`)
      .delete()
  }

  // Shielded transitions no note of ours has been counted into. Newest first,
  // and only the hash: what the row carries comes from the transition itself.
  getShieldedGaps = async (walletId: string, noteAddresses: string[]): Promise<string[]> => {
    const placeholders = noteAddresses.map(() => '?').join(',')
    const rows = await this.knex('platform_transactions')
      .select('hash')
      .where('wallet_id', walletId)
      .where('type', 'like', '%SHIELD%')
      .groupBy('hash')
      .havingRaw(`max(case when source in (${placeholders}) then 1 else 0 end) = 0`, noteAddresses)
      .orderByRaw('max(timestamp) desc')

    return rows.map(row => row.hash as string)
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
