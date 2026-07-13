import type {Knex} from 'knex'

export class ShieldedNoteDAO {
  knex: Knex

  constructor(knex: Knex) {
    this.knex = knex
  }

  getSpentIndexes = async (walletId: string): Promise<Set<number>> => {
    const rows = await this.knex('shielded_spent_notes')
      .select('note_index')
      .where('wallet_id', walletId)
    return new Set(rows.map((row) => row.note_index))
  }

  markSpent = async (walletId: string, indexes: number[]): Promise<void> => {
    if (indexes.length === 0) return
    await this.knex('shielded_spent_notes')
      .insert(indexes.map((noteIndex) => ({wallet_id: walletId, note_index: noteIndex})))
      .onConflict(['wallet_id', 'note_index'])
      .ignore()
  }
}
