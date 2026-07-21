import type {Knex} from 'knex'

export class ShieldedAddressDAO {
  knex: Knex

  constructor(knex: Knex) {
    this.knex = knex
  }

  getAddresses = async (walletId: string): Promise<string[]> => {
    const rows = await this.knex('shielded_addresses')
      .select('address')
      .where('wallet_id', walletId)
      .orderBy('address_index', 'asc')
    return rows.map(row => row.address)
  }

  saveAddresses = async (walletId: string, addresses: string[]): Promise<void> => {
    if (addresses.length === 0) return
    await this.knex('shielded_addresses')
      .insert(addresses.map((address, index) => ({
        wallet_id: walletId,
        address_index: index,
        address,
      })))
      .onConflict(['wallet_id', 'address_index'])
      .merge({address: this.knex.raw('excluded.address')})
  }
}
