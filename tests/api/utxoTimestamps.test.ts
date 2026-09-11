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

const minedTx: AppliedTx = {
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
  txs: [minedTx],
  spends: [],
}

describe('dating the coins a wallet holds', () => {
  it('answers a confirmed coin with the time of the block that carried it', async () => {
    await transactionDAO.applyBlock(block)

    expect(await transactionDAO.getUtxosByAddresses(WALLET, [OWNED])).toEqual([
      {txid: 'mined', vout: 0, address: OWNED, satoshis: '500', height: 2_300_000, blockTime: BLOCK_TIME},
    ])
  })

  // A mempool output has no block to date it, so the store's own record time is
  // the only answer, and the picker still has something to show.
  it('dates a pending coin from when it was first recorded', async () => {
    const before = Math.floor(Date.now() / 1000)
    await transactionDAO.recordPendingTx(WALLET, {...minedTx, txid: 'pending'}, true)

    const [utxo] = await transactionDAO.getUtxosByAddresses(WALLET, [OWNED])
    expect(utxo.height).toBe(0)
    expect(utxo.blockTime).toBeGreaterThanOrEqual(before)
  })

  // The same row, once its block is scanned: the merge has to move the time too,
  // or the coin keeps the moment it was broadcast forever.
  it('replaces the recorded time with the block time once the coin confirms', async () => {
    await transactionDAO.recordPendingTx(WALLET, minedTx, true)
    await transactionDAO.applyBlock(block)

    const [utxo] = await transactionDAO.getUtxosByAddresses(WALLET, [OWNED])
    expect(utxo.blockTime).toBe(BLOCK_TIME)
  })
})
