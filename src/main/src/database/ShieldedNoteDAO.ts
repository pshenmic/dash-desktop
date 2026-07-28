import type {Knex} from 'knex'

export interface PersistNote {
  index: number
  amount: string
  address: string
  spent: boolean
}

// Notes trial-decryption proved belong to this wallet. The ciphertext they were
// decoded from is network state and lives in ShieldedPoolDAO.
export class ShieldedNoteDAO {
  knex: Knex

  constructor(knex: Knex) {
    this.knex = knex
  }

  getUsedAddresses = async (walletId: string): Promise<Set<string>> => {
    const rows = await this.knex('shielded_notes')
      .distinct('address')
      .where({wallet_id: walletId})
    return new Set(rows.map((row) => row.address))
  }

  getOwnedNotes = async (walletId: string): Promise<PersistNote[]> => {
    const rows = await this.knex('shielded_notes')
      .select('note_index', 'amount', 'address', 'spent')
      .where({wallet_id: walletId})
      .orderBy('note_index', 'desc')
    return rows.map((row) => ({
      index: row.note_index,
      amount: row.amount,
      address: row.address,
      spent: Boolean(row.spent),
    }))
  }

  upsertNotes = async (walletId: string, notes: PersistNote[]): Promise<void> => {
    if (notes.length === 0) return
    await this.knex('shielded_notes')
      .insert(notes.map((n) => ({
        wallet_id: walletId,
        note_index: n.index,
        amount: n.amount,
        address: n.address,
        spent: n.spent,
      })))
      .onConflict(['wallet_id', 'note_index'])
      .merge(['amount', 'address', 'spent'])
  }

  // Only ever an update: a spent index that is not already an owned note would
  // mean spending a note we never decoded.
  markSpent = async (walletId: string, indexes: number[]): Promise<void> => {
    if (indexes.length === 0) return
    await this.knex('shielded_notes')
      .where({wallet_id: walletId})
      .whereIn('note_index', indexes)
      .update({spent: true})
  }
}