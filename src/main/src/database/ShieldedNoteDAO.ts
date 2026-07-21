import type {Knex} from 'knex'

export interface PersistNote {
  index: number
  amount: string
  address: string
  spent: boolean
}

export class ShieldedNoteDAO {
  knex: Knex

  constructor(knex: Knex) {
    this.knex = knex
  }

  getSpentIndexes = async (walletId: string): Promise<Set<number>> => {
    const rows = await this.knex('shielded_notes')
      .select('note_index')
      .where({wallet_id: walletId, spent: true})
    return new Set(rows.map((row) => row.note_index))
  }

  // Cache the full note set from a sync. Merges the value/address/spent fields
  // so a note keeps its row (and locally-recorded spends persist) across syncs.
  upsertNotes = async (walletId: string, notes: PersistNote[]): Promise<void> => {
    if (notes.length === 0) return
    await this.knex('shielded_notes')
      .insert(notes.map((n) => ({
        wallet_id: walletId,
        note_index: n.index,
        amount: n.amount,
        address: n.address,
        spent: n.spent,
        is_mine: true,
      })))
      .onConflict(['wallet_id', 'note_index'])
      .merge(['amount', 'address', 'spent'])
  }

  markSpent = async (walletId: string, indexes: number[]): Promise<void> => {
    if (indexes.length === 0) return
    await this.knex('shielded_notes')
      .insert(indexes.map((noteIndex) => ({wallet_id: walletId, note_index: noteIndex, spent: true})))
      .onConflict(['wallet_id', 'note_index'])
      .merge(['spent'])
  }
}