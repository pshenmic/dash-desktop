import type {Knex} from 'knex'
import {Network} from '../types'

import {EncryptedNoteRecord} from '../types/ShieldedNote'
import {PAYLOAD_CHUNK_SIZE, SELECT_CHUNK_SIZE} from '../constants' 
// The Orchard pool: network state, shared by every wallet on that network.
// Trial-decryption is what makes a note a wallet's own, and that lives in
// ShieldedNoteDAO.
export class ShieldedPoolDAO {
  knex: Knex

  constructor(knex: Knex) {
    this.knex = knex
  }

  // Doubles as the download cursor. Notes arrive in order from index 0, so a
  // gap would only come from a truncated batch, and refetching from an aligned
  // start at or below the count heals it.
  getCount = async (network: Network): Promise<number> => {
    const row = await this.knex('shielded_pool_notes')
      .where({network})
      .count('note_index as count')
      .first()
    return Number(row?.count ?? 0)
  }

  saveEncryptedNotes = async (network: Network, notes: EncryptedNoteRecord[]): Promise<void> => {
    for (let offset = 0; offset < notes.length; offset += PAYLOAD_CHUNK_SIZE) {
      const chunk = notes.slice(offset, offset + PAYLOAD_CHUNK_SIZE)
      await this.knex('shielded_pool_notes')
        .insert(chunk.map((n) => ({
          network,
          note_index: n.index,
          nullifier: Buffer.from(n.nullifier),
          cmx: Buffer.from(n.cmx),
          encrypted_note: Buffer.from(n.encryptedNote),
          cv_net: Buffer.from(n.cvNet),
        })))
        .onConflict(['network', 'note_index'])
        .ignore()
    }
  }

  getEncryptedNotes = async (network: Network, indexes: number[]): Promise<EncryptedNoteRecord[]> => {
    const result: EncryptedNoteRecord[] = []
    for (let offset = 0; offset < indexes.length; offset += SELECT_CHUNK_SIZE) {
      const rows = await this.knex('shielded_pool_notes')
        .select('note_index', 'nullifier', 'cmx', 'encrypted_note', 'cv_net')
        .where({network})
        .whereIn('note_index', indexes.slice(offset, offset + SELECT_CHUNK_SIZE))
        .orderBy('note_index', 'asc')
      result.push(...rows.map(toRecord))
    }
    return result
  }

  getEncryptedNotesFrom = async (network: Network, startIndex: number): Promise<EncryptedNoteRecord[]> => {
    const rows = await this.knex('shielded_pool_notes')
      .select('note_index', 'nullifier', 'cmx', 'encrypted_note', 'cv_net')
      .where({network})
      .where('note_index', '>=', startIndex)
      .orderBy('note_index', 'asc')
    return rows.map(toRecord)
  }

  getAllEncryptedNotes = async (network: Network): Promise<EncryptedNoteRecord[]> => {
    const rows = await this.knex('shielded_pool_notes')
      .select('note_index', 'nullifier', 'cmx', 'encrypted_note', 'cv_net')
      .where({network})
      .orderBy('note_index', 'asc')
    return rows.map(toRecord)
  }
}

function toRecord(row): EncryptedNoteRecord {
  return {
    index: row.note_index,
    nullifier: row.nullifier,
    cmx: row.cmx,
    encryptedNote: row.encrypted_note,
    cvNet: row.cv_net,
  }
}