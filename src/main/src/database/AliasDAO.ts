import type {Knex} from 'knex'
import {Alias} from '../types/Alias'

function fromRow(row, contenders: Alias['contenders']): Alias {
  return {
    walletId: row.wallet_id,
    identifier: row.identifier,
    label: row.label,
    normalizedLabel: row.normalized_label,
    isContested: Boolean(row.is_contested),
    status: row.status,
    documentId: row.document_id,
    preorderSalt: row.preorder_salt ?? null,
    votesLock: row.votes_lock,
    votesAbstain: row.votes_abstain,
    voteEndsAt: row.vote_ends_at,
    voteOutcome: row.vote_outcome,
    voteWinner: row.vote_winner,
    contenders,
    createdAt: row.created_at,
    checkedAt: row.checked_at,
  }
}

export class AliasDAO {
  knex: Knex

  constructor(knex: Knex) {
    this.knex = knex
  }

  getAliases = async (walletId: string): Promise<Alias[]> => {
    const [rows, contenders] = await Promise.all([
      this.knex('aliases').select('*').where('wallet_id', walletId).orderBy('created_at', 'asc'),
      this.knex('alias_contenders').select('*').where('wallet_id', walletId).orderBy('votes', 'desc'),
    ])
    return rows.map(row => fromRow(row, contenders
      .filter(contender => contender.identifier === row.identifier && contender.normalized_label === row.normalized_label)
      .map(contender => ({identifier: contender.contender_id, votes: contender.votes}))))
  }

  save = async (alias: Alias): Promise<void> => {
    const key = {wallet_id: alias.walletId, identifier: alias.identifier, normalized_label: alias.normalizedLabel}
    await this.knex.transaction(async trx => {
      await trx('aliases')
        .insert({
          ...key,
          label: alias.label,
          is_contested: alias.isContested,
          status: alias.status,
          document_id: alias.documentId,
          preorder_salt: alias.preorderSalt == null ? null : Buffer.from(alias.preorderSalt),
          votes_lock: alias.votesLock,
          votes_abstain: alias.votesAbstain,
          vote_ends_at: alias.voteEndsAt,
          vote_outcome: alias.voteOutcome,
          vote_winner: alias.voteWinner,
          created_at: alias.createdAt,
          checked_at: alias.checkedAt,
        })
        .onConflict(['wallet_id', 'identifier', 'normalized_label'])
        .merge()
      await trx('alias_contenders').where(key).delete()
      if (alias.contenders.length > 0) {
        await trx('alias_contenders').insert(alias.contenders.map(contender => ({...key, contender_id: contender.identifier, votes: contender.votes})))
      }
    })
  }
}
