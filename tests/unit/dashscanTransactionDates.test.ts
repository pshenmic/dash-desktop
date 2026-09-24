import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import type {Knex} from 'knex'

const fetches = vi.hoisted(() => ({body: null as unknown}))

vi.mock('electron', () => ({
  net: {
    fetch: () => Promise.resolve({ok: true, status: 200, json: async () => fetches.body} as Response),
  },
}))

import {DashscanWalletProvider} from '../../src/main/src/providers/DashscanWalletProvider'
import {AddressDAO} from '../../src/main/src/database/AddressDAO'
import {WalletDAO} from '../../src/main/src/database/WalletDAO'
import {TransactionDAO} from '../../src/main/src/database/TransactionDAO'
import {getKnex, migrateKnex} from '../../src/main/src/utils'

const WALLET = 'w1'
const OURS = 'yRd4FhXfVGHXpsuZXPNkMrfD9GVj46pnjt'
const XPUB = 'tpubDC5FSnBiZDMmhiuCmWAYsLwgLYrrT9rAqvTySfuCCrgsWz8wxMXUS9Tb9iVMvcRbvFcAHGkMD5Kx8koh4GquNGNTfohfk7pgjhaPCdXpoba'
const LOCK = 'a'.repeat(64)
// The asset lock reached us a second and a half before the block it funded was
// carried, and fifteen seconds before the block that carried the lock itself.
const BROADCAST = Date.parse('2026-09-24T17:44:58.997Z')
const BLOCK = '2026-09-24T17:45:15.000Z'

let knex: Knex
let transactionDAO: TransactionDAO

const walletDAO = {getWalletById: async () => ({coreXpub: XPUB})} as unknown as WalletDAO
const addressDAO = {
  getAddressesByWalletId: async () => ({receiving: [{address: OURS}], change: []}),
} as unknown as AddressDAO

const dashscanPage = {
  resultSet: [{
    hash: LOCK,
    type: 'ASSET_LOCK',
    blockHeight: 1_559_945,
    blockHash: 'block',
    timestamp: BLOCK,
    amount: '100000',
    version: 3,
    size: 225,
    vIn: [{prevTxHash: 'b'.repeat(64), vOutIndex: 1, address: OURS, amount: '100000', sequence: null, scriptSigASM: null}],
    vOut: [{
      value: 90000, number: 0, scriptPubKeyASM: null, scriptPubKeyHex: null, scriptPubKeyType: 'pubkeyhash',
      address: OURS, addresses: [OURS], spentTxId: null, spentIndex: null, spentHeight: null,
    }],
    confirmations: 5,
    instantLock: 'lock',
    chainLocked: false,
    coinjoin: false,
    multisig: false,
  }],
  pagination: {limit: 100, nextCursor: null},
}

const history = async (): Promise<{date: Date}[]> =>
  new DashscanWalletProvider('testnet', WALLET, addressDAO, walletDAO, transactionDAO).getWalletTransactions()

beforeEach(async () => {
  knex = getKnex()
  await migrateKnex(knex)
  await knex('wallet').insert({wallet_id: WALLET, network: 'testnet', encrypted_mnemonic: 'm'})
  transactionDAO = new TransactionDAO(knex)
  fetches.body = dashscanPage
})

afterEach(async () => {
  await knex.destroy()
})

describe('dating the history Dashscan answers with', () => {
  it('dates a tx this wallet never saw broadcast by the block that carried it', async () => {
    const [transaction] = await history()

    expect(transaction.date).toEqual(new Date(BLOCK))
  })

  // Dashscan knows only the block, which is minutes past the platform
  // transition an asset lock funded — so the pair reads backwards on the list.
  it('dates one it broadcast itself from the moment it was sent', async () => {
    await transactionDAO.recordPendingTx(WALLET, {txid: LOCK, raw: new Uint8Array([1]), inputs: [], outputs: []}, true)
    await knex('transactions').where({wallet_id: WALLET, txid: LOCK}).update({first_seen_at: BROADCAST})

    const [transaction] = await history()

    expect(transaction.date).toEqual(new Date(BROADCAST))
  })
})
