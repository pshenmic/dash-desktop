import type {Knex} from 'knex'
import {ShieldedAddressRow} from '../types/ShieldedAddress'

function fromRow({wallet_id, address_index, address, is_used}): ShieldedAddressRow {
  return {
    walletId: wallet_id,
    index: address_index,
    address,
    isUsed: Boolean(is_used),
  }
}

export class ShieldedAddressDAO {
  knex: Knex

  constructor(knex: Knex) {
    this.knex = knex
  }

  getAddresses = async (walletId: string): Promise<ShieldedAddressRow[]> => {
    const rows = await this.knex('shielded_addresses')
      .select('wallet_id', 'address_index', 'address', 'is_used')
      .where('wallet_id', walletId)
      .orderBy('address_index', 'asc')
    return rows.map(fromRow)
  }

  insertAddresses = async (addresses: ShieldedAddressRow[]): Promise<void> => {
    if (addresses.length === 0) return
    await this.knex('shielded_addresses')
      .insert(addresses.map(entry => ({
        wallet_id: entry.walletId,
        address_index: entry.index,
        address: entry.address,
        is_used: entry.isUsed,
      })))
      .onConflict(['wallet_id', 'address_index'])
      .ignore()
  }

  markAddressesUsed = async (walletId: string, indexes: number[]): Promise<void> => {
    if (indexes.length === 0) return
    await this.knex('shielded_addresses')
      .where('wallet_id', walletId)
      .whereIn('address_index', indexes)
      .update({is_used: true})
  }
}
