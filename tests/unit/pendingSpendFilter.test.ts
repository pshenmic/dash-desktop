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
import {PENDING_SPEND_TTL_MS} from '../../src/main/src/constants/chain'
import {getKnex, migrateKnex} from '../../src/main/src/utils'

const WALLET = 'w1'
const OURS = 'yRd4FhXfVGHXpsuZXPNkMrfD9GVj46pnjt'
const XPUB = 'tpubDC5FSnBiZDMmhiuCmWAYsLwgLYrrT9rAqvTySfuCCrgsWz8wxMXUS9Tb9iVMvcRbvFcAHGkMD5Kx8koh4GquNGNTfohfk7pgjhaPCdXpoba'
const COIN = 'a'.repeat(64)
const SPENDER = 'b'.repeat(64)

let knex: Knex
let transactionDAO: TransactionDAO

const walletDAO = {getWalletById: async () => ({coreXpub: XPUB})} as unknown as WalletDAO
const addressDAO = {
  getAddressesByWalletId: async () => ({receiving: [{address: OURS}], change: []}),
} as unknown as AddressDAO

// One coin, which Dashscan still reports as unspent.
const dashscanUtxoPage = {
  resultSet: [{
    address: OURS, prevTxHash: COIN, vOutIndex: 0, amount: '100000',
    scriptPubKeyHex: '76a914a3890b802865e1cfeed7653d0fea33831d709b6f88ac',
    blockHeight: 100, timestamp: null, confirmations: 10,
  }],
  pagination: {page: 1, limit: 100, total: 1},
}

const spendOfCoin = {
  txid: SPENDER,
  raw: new Uint8Array([1]),
  inputs: [{vin: 0, prevTxid: COIN, prevVout: 0, sequence: 0xffffffff}],
  outputs: [{vout: 0, address: OURS, satoshis: '90000', isMine: true}],
}

const utxos = async (): Promise<unknown[]> =>
  new DashscanWalletProvider('testnet', WALLET, addressDAO, walletDAO, transactionDAO).getWalletUtxos()

beforeEach(async () => {
  knex = getKnex()
  await migrateKnex(knex)
  await knex('wallet').insert({wallet_id: WALLET, network: 'testnet', encrypted_mnemonic: 'm'})
  transactionDAO = new TransactionDAO(knex)
  fetches.body = dashscanUtxoPage
})

afterEach(async () => {
  await knex.destroy()
})

describe('coins Dashscan still lists after we spent them', () => {
  it('offers a coin no local transaction has spent', async () => {
    expect(await utxos()).toHaveLength(1)
  })

  // Dashscan indexes the spending transaction some time after we broadcast it.
  // Until it does, reselecting this coin builds a conflict every peer drops.
  it('drops a coin a pending local transaction already spent', async () => {
    await transactionDAO.recordPendingTx(WALLET, spendOfCoin, true)

    expect(await utxos()).toEqual([])
  })

  it('offers the coin again once the spending transaction confirms', async () => {
    await transactionDAO.recordPendingTx(WALLET, spendOfCoin, true)
    await transactionDAO.applyBlock({
      walletId: WALLET, height: 200, blockHash: 'h', blockTime: 1_700_000_000,
      txs: [spendOfCoin], spends: [],
    })

    expect(await utxos()).toHaveLength(1)
  })

  // A transaction that never confirmed would otherwise strand its inputs, since
  // an rpc-mode wallet applies no blocks to clear the row.
  it('stops suppressing a coin once the spend is older than the window', async () => {
    await transactionDAO.recordPendingTx(WALLET, spendOfCoin, true)
    await knex('transactions')
      .where({wallet_id: WALLET, txid: SPENDER})
      .update({first_seen_at: Date.now() - PENDING_SPEND_TTL_MS - 1})

    expect(await utxos()).toHaveLength(1)
  })
})
