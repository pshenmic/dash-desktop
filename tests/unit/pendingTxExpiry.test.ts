import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import type {Knex} from 'knex'
import {TransactionDAO} from '../../src/main/src/database/TransactionDAO'
import {PENDING_TX_TTL_MS} from '../../src/main/src/constants/chain'
import {getKnex, migrateKnex} from '../../src/main/src/utils'

const WALLET = 'w1'
const TXID = 'b'.repeat(64)

const send = {
  txid: TXID,
  raw: new Uint8Array([1]),
  inputs: [{vin: 0, prevTxid: 'a'.repeat(64), prevVout: 0, sequence: 0xffffffff}],
  outputs: [{vout: 0, address: 'yRd4FhXfVGHXpsuZXPNkMrfD9GVj46pnjt', satoshis: '90000', isMine: false}],
}

let knex: Knex
let transactionDAO: TransactionDAO

const pendingTxids = async (): Promise<string[]> =>
  (await transactionDAO.getPendingTxs(WALLET, Date.now() - PENDING_TX_TTL_MS)).map(p => p.txid)

beforeEach(async () => {
  knex = getKnex()
  await migrateKnex(knex)
  await knex('wallet').insert({wallet_id: WALLET, network: 'testnet', encrypted_mnemonic: 'm'})
  transactionDAO = new TransactionDAO(knex)
  await transactionDAO.recordPendingTx(WALLET, send, true)
})

afterEach(async () => {
  await knex.destroy()
})

describe('pending transactions the rebroadcast loop and lock watch pick up', () => {
  it('includes a transaction broadcast within the window', async () => {
    expect(await pendingTxids()).toEqual([TXID])
  })

  // Mined while the scan missed it, or dropped silently: either way, pushing it
  // again only keeps the worker fetching every lock on the network.
  it('drops a transaction still unconfirmed past the window', async () => {
    await knex('transactions')
      .where({wallet_id: WALLET, txid: TXID})
      .update({first_seen_at: Date.now() - PENDING_TX_TTL_MS - 1})

    expect(await pendingTxids()).toEqual([])
  })

  it('keeps the expired row unconfirmed so a block can still settle it', async () => {
    await knex('transactions')
      .where({wallet_id: WALLET, txid: TXID})
      .update({first_seen_at: Date.now() - PENDING_TX_TTL_MS - 1})

    expect(await transactionDAO.getUnconfirmedInputOutpoints(WALLET)).toEqual([{txid: 'a'.repeat(64), vout: 0}])
  })
})
