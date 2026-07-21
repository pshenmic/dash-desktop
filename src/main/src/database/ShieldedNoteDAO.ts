import type {Knex} from 'knex'

export interface PersistNote {
  index: number
  amount: string
  address: string
  spent: boolean
}

// SQLite bind-variable limit safety.
const INSERT_CHUNK_SIZE = 400

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

  // High-water mark of pool notes this wallet has seen; compared with the
  // network note count to detect new notes.
  getKnownCount = async (walletId: string): Promise<number> => {
    const row = await this.knex('shielded_notes')
      .where({wallet_id: walletId})
      .max('note_index as max')
      .first()
    return row?.max != null ? Number(row.max) + 1 : 0
  }

  // Records pool notes [from, to) as known-but-undecoded. The ciphertexts
  // themselves stay in the ShieldedService memory cache; only the pending
  // trial-decryption is persisted.
  insertUndecoded = async (walletId: string, from: number, to: number): Promise<void> => {
    for (let start = from; start < to; start += INSERT_CHUNK_SIZE) {
      const end = Math.min(start + INSERT_CHUNK_SIZE, to)
      const rows = Array.from({length: end - start}, (_, i) => ({
        wallet_id: walletId,
        note_index: start + i,
      }))
      await this.knex('shielded_notes')
        .insert(rows)
        .onConflict(['wallet_id', 'note_index'])
        .ignore()
    }
  }

  getUndecodedIndexes = async (walletId: string): Promise<number[]> => {
    const rows = await this.knex('shielded_notes')
      .select('note_index')
      .where({wallet_id: walletId, is_decoded: false})
      .orderBy('note_index', 'asc')
    return rows.map((row) => row.note_index)
  }

  getUndecodedCount = async (walletId: string): Promise<number> => {
    const row = await this.knex('shielded_notes')
      .where({wallet_id: walletId, is_decoded: false})
      .count('note_index as count')
      .first()
    return Number(row?.count ?? 0)
  }

  markDecodedBelow = async (walletId: string, count: number): Promise<void> => {
    if (count <= 0) return
    await this.knex('shielded_notes')
      .where({wallet_id: walletId, is_decoded: false})
      .where('note_index', '<', count)
      .update({is_decoded: true})
  }

  getOwnedNotes = async (walletId: string): Promise<PersistNote[]> => {
    const rows = await this.knex('shielded_notes')
      .select('note_index', 'amount', 'address', 'spent')
      .where({wallet_id: walletId, is_mine: true})
      .whereNotNull('amount')
      .orderBy('note_index', 'desc')
    return rows.map((row) => ({
      index: row.note_index,
      amount: row.amount,
      address: row.address,
      spent: Boolean(row.spent),
    }))
  }

  // Cache the owned notes found by a decode. Merges the value/address/spent
  // fields so a note keeps its row (and locally-recorded spends persist)
  // across syncs.
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
        is_decoded: true,
      })))
      .onConflict(['wallet_id', 'note_index'])
      .merge(['amount', 'address', 'spent', 'is_mine', 'is_decoded'])
  }

  markSpent = async (walletId: string, indexes: number[]): Promise<void> => {
    if (indexes.length === 0) return
    await this.knex('shielded_notes')
      .insert(indexes.map((noteIndex) => ({wallet_id: walletId, note_index: noteIndex, spent: true})))
      .onConflict(['wallet_id', 'note_index'])
      .merge(['spent'])
  }
}
