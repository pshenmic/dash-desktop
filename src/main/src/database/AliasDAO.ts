import type {Knex} from 'knex'
import {Alias} from '../types/Alias'

function fromRow(row): Alias {
  return {
    walletId: row.wallet_id,
    identifier: row.identifier,
    label: row.label,
    normalizedLabel: row.normalized_label,
    isContested: Boolean(row.is_contested),
    status: row.status,
    documentId: row.document_id,
    preorderSalt: row.preorder_salt ?? null,
    votesFor: row.votes_for,
    votesLock: row.votes_lock,
    votesAbstain: row.votes_abstain,
    voteEndsAt: row.vote_ends_at,
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
    const rows = await this.knex('aliases')
      .select('*')
      .where('wallet_id', walletId)
      .orderBy('created_at', 'asc')
    return rows.map(fromRow)
  }

  save = async (alias: Alias): Promise<void> => {
    await this.knex('aliases')
      .insert({
        wallet_id: alias.walletId,
        identifier: alias.identifier,
        label: alias.label,
        normalized_label: alias.normalizedLabel,
        is_contested: alias.isContested,
        status: alias.status,
        document_id: alias.documentId,
        preorder_salt: alias.preorderSalt == null ? null : Buffer.from(alias.preorderSalt),
        votes_for: alias.votesFor,
        votes_lock: alias.votesLock,
        votes_abstain: alias.votesAbstain,
        vote_ends_at: alias.voteEndsAt,
        created_at: alias.createdAt,
        checked_at: alias.checkedAt,
      })
      .onConflict(['wallet_id', 'identifier', 'normalized_label'])
      .merge()
  }
}
