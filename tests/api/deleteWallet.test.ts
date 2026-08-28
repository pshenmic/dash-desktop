import {describe, it, expect, beforeEach} from 'vitest'
import {WalletDAO} from '../../src/main/src/database/WalletDAO'
import {WALLET_SCOPED_TABLES} from '../../src/main/src/constants/database'
import {getKnex, migrateKnex} from '../../src/main/src/utils'
import type {Knex} from 'knex'

const WALLET = 'doomed'
const KEEPER = 'keeper'

// One row per wallet-scoped table, filled only as far as NOT NULL demands.
const rows = (walletId: string): Record<string, Record<string, unknown>> => ({
  identities: {wallet_id: walletId, identity_index: 0, derivation_path: "m/9'/1'/5'/0'/0", identifier: `id-${walletId}`},
  addresses: {wallet_id: walletId, address: `addr-${walletId}`, derivation_path: "m/44'/1'/0'/0/0", account_id: 0, index: 0},
  transactions: {wallet_id: walletId, txid: `tx-${walletId}`, block_height: 1, block_hash: 'h', block_time: 0, raw: Buffer.from([1])},
  transaction_outputs: {wallet_id: walletId, txid: `tx-${walletId}`, vout: 0, satoshis: '1000'},
  transaction_inputs: {wallet_id: walletId, txid: `tx-${walletId}`, vin: 0, prev_txid: 'p', prev_vout: 0, sequence: 0},
  wallet_sync_state: {wallet_id: walletId},
  asset_lock_fundings: {wallet_id: walletId, txid: `al-${walletId}`, output_index: 0, credit_derivation_path: "m/9'/1'/5'/2'/0", amount_duffs: '1000', to_platform_address: 'dest', status: 'l1_broadcast'},
  platform_addresses: {wallet_id: walletId, address_index: 0, address: `pa-${walletId}`, derivation_path: "m/9'/1'/17'/0'/0'/0"},
  shielded_addresses: {wallet_id: walletId, address_index: 0, address: `sh-${walletId}`},
  shielded_notes: {wallet_id: walletId, note_index: 0, amount: '1', address: `sh-${walletId}`},
})

// Discovered rather than listed, so a table added later shows up here even
// though this test predates it.
async function walletScopedTables(knex: Knex): Promise<string[]> {
  const tables = await knex('sqlite_master')
    .select('name')
    .where('type', 'table')
    .whereNot('name', 'like', 'sqlite_%')
    .whereNot('name', 'like', 'knex%')

  const scoped: string[] = []
  for (const {name} of tables) {
    const columns = await knex.raw(`PRAGMA table_info(${name})`) as Array<{name: string}>
    if (columns.some(c => c.name === 'wallet_id')) scoped.push(name)
  }
  return scoped
}

describe('deleting a wallet', () => {
  let knex: Knex
  let walletDAO: WalletDAO

  beforeEach(async () => {
    knex = getKnex()
    await migrateKnex(knex)
    walletDAO = new WalletDAO(knex)
    // encrypted_mnemonic is unique, so the two wallets cannot share one.
    await walletDAO.saveWallet('encrypted-doomed', WALLET, 'testnet', null)
    await walletDAO.saveWallet('encrypted-keeper', KEEPER, 'testnet', null)
  })

  // The defect: three tables were cleared and seven were not, leaving the whole
  // L1 history and every shielded note's decrypted amount and address on disk.
  it('leaves no row keyed to the deleted wallet', async () => {
    for (const [table, row] of Object.entries(rows(WALLET))) await knex(table).insert(row)

    await walletDAO.deleteWallet(WALLET)

    for (const table of Object.keys(rows(WALLET))) {
      const [{count}] = await knex(table).where('wallet_id', WALLET).count({count: '*'})
      expect(Number(count), `${table} still holds rows for the deleted wallet`).toBe(0)
    }
  })

  // The constant drives the delete, so a table added without being listed there
  // would silently survive — which is how the original seven were missed.
  it('lists every wallet-scoped table the schema actually has', async () => {
    const discovered = (await walletScopedTables(knex)).filter(t => t !== 'wallet').sort()

    expect([...WALLET_SCOPED_TABLES].sort()).toEqual(discovered)
  })

  it('touches nothing belonging to another wallet', async () => {
    for (const [table, row] of Object.entries(rows(KEEPER))) await knex(table).insert(row)

    await walletDAO.deleteWallet(WALLET)

    expect(await walletDAO.getWalletById(KEEPER)).not.toBeNull()
    for (const table of Object.keys(rows(KEEPER))) {
      const [{count}] = await knex(table).where('wallet_id', KEEPER).count({count: '*'})
      expect(Number(count), `${table} lost the surviving wallet's rows`).toBe(1)
    }
  })

  it('promotes a survivor when the deleted wallet was selected', async () => {
    await walletDAO.setSelectedWallet(WALLET)

    await walletDAO.deleteWallet(WALLET)

    expect((await walletDAO.getSelectedWallet())?.walletId).toBe(KEEPER)
  })

  // Partial deletion is the worst outcome: a wallet gone from the list with its
  // history still on disk and no way to reach it.
  it('rolls back entirely when one table fails', async () => {
    for (const [table, row] of Object.entries(rows(WALLET))) await knex(table).insert(row)
    await knex.schema.dropTable('shielded_notes')

    await expect(walletDAO.deleteWallet(WALLET)).rejects.toThrow()

    expect(await walletDAO.getWalletById(WALLET)).not.toBeNull()
    const [{count}] = await knex('transactions').where('wallet_id', WALLET).count({count: '*'})
    expect(Number(count)).toBe(1)
  })
})
