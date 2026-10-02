import type {Knex} from 'knex'
import {PlatformTransaction, PlatformTransactionPart, PlatformTxStatus} from '../types/PlatformTransaction'
import {INSERT_CHUNK_SIZE, LOCAL_SOURCE_PREFIX} from '../constants/database'
import {CREDITS_PER_DUFF} from '../constants/credits'
import {chunk} from '../utils/chunk'

function fromRow({
  wallet_id, hash, type, timestamp, block_height, status, error, gas_credits, net_credits,
}, lockedCredits: bigint | null, parts: Pick<PlatformTransaction, 'sender' | 'recipient'> | null): PlatformTransaction {
  const net = BigInt(net_credits)
  const amounts = parts == null ? [] : [...parts.sender, ...parts.recipient].map(part => part.amount)
  const largest = amounts.length === 0 ? null : amounts.reduce((amount, next) => next > amount ? next : amount)
  const moved = largest == null
    ? net === 0n && lockedCredits != null ? lockedCredits : (net < 0n ? -net : net)
    : largest === 0n && net === 0n && lockedCredits != null ? lockedCredits : largest

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
    sender: parts?.sender ?? [],
    recipient: parts?.recipient ?? [],
  }
}

export class PlatformTransactionDAO {
  knex: Knex

  constructor(knex: Knex) {
    this.knex = knex
  }

  getTransactions = async (walletId: string): Promise<PlatformTransaction[]> => {
    const [rows, fundings, partRows] = await this.knex.transaction(async trx => Promise.all([
      trx('platform_transactions')
        .select('wallet_id', 'hash', 'source', 'type', 'timestamp', 'block_height', 'status',
          'error', 'gas_credits', 'net_credits')
        .where('wallet_id', walletId)
        .orderBy('timestamp', 'desc'),
      trx('asset_lock_fundings')
        .select('st_hash', 'amount_duffs')
        .where('wallet_id', walletId)
        .whereNotNull('st_hash'),
      trx('platform_transaction_parts')
        .select('hash', 'parent_source', 'side', 'entry_index', 'part_source', 'amount_credits')
        .where('wallet_id', walletId)
        .orderBy('hash')
        .orderBy('parent_source')
        .orderBy('side')
        .orderBy('entry_index'),
    ]))

    const locked = new Map(fundings.map(funding => [
      (funding.st_hash as string).toLowerCase(),
      BigInt(funding.amount_duffs as string) * CREDITS_PER_DUFF,
    ]))
    const partsByHash = new Map<string, Map<string, {sender: PlatformTransactionPart[], recipient: PlatformTransactionPart[]}>>()

    for (const part of partRows) {
      const hash = part.hash as string
      const parentSource = part.parent_source as string
      let bySource = partsByHash.get(hash)
      if (bySource == null) {
        bySource = new Map()
        partsByHash.set(hash, bySource)
      }

      let sides = bySource.get(parentSource)
      if (sides == null) {
        sides = {sender: [], recipient: []}
        bySource.set(parentSource, sides)
      }

      sides[part.side as 'sender' | 'recipient'].push({
        source: part.part_source as string,
        amount: BigInt(part.amount_credits as string),
      })
    }

    return rows.map(row => fromRow(
      row,
      locked.get((row.hash as string).toLowerCase()) ?? null,
      partsByHash.get(row.hash as string)?.get(row.source as string) ?? null,
    ))
  }

  upsertTransactions = async (source: string, transactions: PlatformTransaction[]): Promise<void> => {
    // dpp hashes a transition in lower case and the explorer answers in upper:
    // one case, or the row a send wrote is never the row a walk replaces.
    const unique = Array.from(new Map(transactions
      .map(row => [row.hash.toUpperCase(), {...row, hash: row.hash.toUpperCase()}] as const)).values())
    if (unique.length === 0) return

    await this.knex.transaction(async trx => {
      for (const rows of chunk(unique, INSERT_CHUNK_SIZE)) {
        await trx('platform_transactions')
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
          })))
          .onConflict(['wallet_id', 'hash', 'source'])
          .merge()
      }

      await trx('platform_transaction_parts')
        .where({wallet_id: unique[0].walletId, parent_source: source})
        .whereIn('hash', unique.map(transaction => transaction.hash))
        .delete()

      const parts = unique.flatMap(transaction => [
        ...transaction.sender.map((part, entryIndex) => ({
          wallet_id: transaction.walletId,
          hash: transaction.hash,
          parent_source: source,
          side: 'sender',
          entry_index: entryIndex,
          part_source: part.source,
          amount_credits: part.amount.toString(),
        })),
        ...transaction.recipient.map((part, entryIndex) => ({
          wallet_id: transaction.walletId,
          hash: transaction.hash,
          parent_source: source,
          side: 'recipient',
          entry_index: entryIndex,
          part_source: part.source,
          amount_credits: part.amount.toString(),
        })),
      ])
      for (const rows of chunk(parts, INSERT_CHUNK_SIZE)) {
        await trx('platform_transaction_parts').insert(rows)
      }

      if (!source.startsWith(LOCAL_SOURCE_PREFIX)) {
        const localSource = `${LOCAL_SOURCE_PREFIX}${source}`
        await trx('platform_transaction_parts')
          .where({wallet_id: unique[0].walletId, parent_source: localSource})
          .whereIn('hash', unique.map(transaction => transaction.hash))
          .delete()
        await trx('platform_transactions')
          .where({wallet_id: unique[0].walletId, source: localSource})
          .whereIn('hash', unique.map(transaction => transaction.hash))
          .delete()
      }
    })
  }

  deleteRetiredSources = async (walletId: string, sources: string[]): Promise<void> => {
    await this.knex.transaction(async trx => {
      await trx('platform_transaction_parts')
        .where('wallet_id', walletId)
        .whereNotIn('parent_source', sources)
        .whereNot('parent_source', 'like', `${LOCAL_SOURCE_PREFIX}%`)
        .delete()
      await trx('platform_transactions')
        .where('wallet_id', walletId)
        .whereNotIn('source', sources)
        // A send's own rows answer to the participant that replaces them: the address it
        // paid need not be one this wallet asks about.
        .whereNot('source', 'like', `${LOCAL_SOURCE_PREFIX}%`)
        .delete()
    })
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
