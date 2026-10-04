import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import type {Knex} from 'knex'
import type {AppliedBlock, AppliedTx} from '../../src/main/p2p/types/walletSync'
import {TransactionDAO} from '../../src/main/src/database/TransactionDAO'
import {getKnex, migrateKnex} from '../../src/main/src/utils'

const WALLET = 'w1'
const OWNED = 'core-1'
const BLOCK_TIME = 1_700_000_000

let knex: Knex
let transactionDAO: TransactionDAO

beforeEach(async () => {
  knex = getKnex()
  await migrateKnex(knex)
  await knex('wallet').insert({wallet_id: WALLET, network: 'testnet', encrypted_mnemonic: 'm'})
  transactionDAO = new TransactionDAO(knex)
})

afterEach(async () => {
  await knex.destroy()
})

const tx: AppliedTx = {
  txid: 'mined',
  raw: new Uint8Array([1]),
  inputs: [],
  outputs: [{vout: 0, address: OWNED, satoshis: '500', isMine: true}],
}

const block: AppliedBlock = {
  walletId: WALLET,
  height: 2_300_000,
  blockHash: 'hash',
  blockTime: BLOCK_TIME,
  txs: [tx],
  spends: [],
}

describe('dating a wallet transaction', () => {
  it('dates a tx this wallet only ever read out of a block by that block', async () => {
    await transactionDAO.applyBlock(block)

    const [row] = await transactionDAO.getTransactionsByWallet(WALLET)
    expect(row.date).toEqual(new Date(BLOCK_TIME * 1000))
  })

  it('keeps the moment a tx was seen once its block moves the block time', async () => {
    const before = Date.now()
    await transactionDAO.recordPendingTx(WALLET, tx, true)
    await transactionDAO.applyBlock(block)

    const [row] = await transactionDAO.getTransactionsByWallet(WALLET)
    expect(row.date.getTime()).toBeGreaterThanOrEqual(before)
  })
})
