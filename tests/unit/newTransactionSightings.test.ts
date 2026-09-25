import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import type {Knex} from 'knex'
import {TransactionDAO} from '../../src/main/src/database/TransactionDAO'
import {getKnex, migrateKnex} from '../../src/main/src/utils'

const WALLET = 'w1'
const OURS = 'yRd4FhXfVGHXpsuZXPNkMrfD9GVj46pnjt'
const THEIRS = 'yTb2u1WzMvEDcKrLkZdMKNBpKnSyYAcLxq'
const COIN = 'a'.repeat(64)
const SPEND = 'b'.repeat(64)
const INBOUND = 'c'.repeat(64)

let knex: Knex
let dao: TransactionDAO

const funding = {
  walletId: WALLET, height: 100, blockHash: 'h1', blockTime: 1_700_000_000, spends: [],
  txs: [{
    txid: COIN, raw: new Uint8Array([1]), inputs: [],
    outputs: [{vout: 0, address: OURS, satoshis: '100000', isMine: true}],
  }],
}

// The shape SyncService.onTx builds from a mempool sighting: outputs matched
// against the watch set, inputs carrying only the outpoint they spend.
const ourSpend = {
  txid: SPEND, raw: new Uint8Array([2]),
  inputs: [{vin: 0, prevTxid: COIN, prevVout: 0, sequence: 0xffffffff}],
  outputs: [
    {vout: 0, address: THEIRS, satoshis: '60000', isMine: false},
    {vout: 1, address: OURS, satoshis: '39000', isMine: true},
  ],
}

const strangerPayingUs = {
  txid: INBOUND, raw: new Uint8Array([3]),
  inputs: [{vin: 0, prevTxid: 'd'.repeat(64), prevVout: 0, sequence: 0xffffffff}],
  outputs: [{vout: 0, address: OURS, satoshis: '50000', isMine: true}],
}

const blockOf = (tx: typeof ourSpend, height: number) => ({
  walletId: WALLET, height, blockHash: `h${height}`, blockTime: 1_700_000_100, txs: [tx], spends: [],
})

beforeEach(async () => {
  knex = getKnex()
  await migrateKnex(knex)
  await knex('wallet').insert({wallet_id: WALLET, network: 'testnet', encrypted_mnemonic: 'm'})
  dao = new TransactionDAO(knex)
  await dao.applyBlock(funding)
})

afterEach(async () => { await knex.destroy() })

// One payment is sighted up to three times — our own broadcast, the mempool inv
// the lock pool sends straight back, and its block — and the row's absence is
// what tells the first sighting from the rest.
describe('which sighting of a transaction is the first', () => {
  it('reports a transaction it had no row for', async () => {
    expect(await dao.recordPendingTx(WALLET, ourSpend, true)).toBe(true)
  })

  // The mempool inv for a transaction we just broadcast, which onTx does not
  // filter out: our own change pays a watched address.
  it('stays quiet when the row is already there', async () => {
    await dao.recordPendingTx(WALLET, ourSpend, true)
    expect(await dao.recordPendingTx(WALLET, ourSpend, false)).toBe(false)
  })

  it('leaves a transaction out of a block once it was seen in the mempool', async () => {
    await dao.recordPendingTx(WALLET, ourSpend, false)
    expect(await dao.applyBlock(blockOf(ourSpend, 200))).toEqual([])
  })

  it('reports a transaction whose block is the first sighting', async () => {
    const added = await dao.applyBlock(blockOf(strangerPayingUs, 200))
    expect(added.map(tx => tx.txid)).toEqual([INBOUND])
  })

  it('stays quiet when the same block is applied again', async () => {
    await dao.applyBlock(blockOf(strangerPayingUs, 200))
    expect(await dao.applyBlock(blockOf(strangerPayingUs, 200))).toEqual([])
  })
})

// Why the broadcast path needs no claim on the txid before it sends: whichever
// sighting lands first reads the right direction, because the inputs a mempool
// sighting writes join to this wallet's own earlier outputs.
describe('direction read back from a single sighting', () => {
  it('calls our own spend outgoing without the optimistic record', async () => {
    await dao.recordPendingTx(WALLET, ourSpend, false)
    const tx = await dao.getTransactionByTxid(WALLET, SPEND)
    expect(tx?.direction).toBe(-1)
    expect(tx?.inAmount).toBe(100_000n)
    expect(tx?.transferAmount).toBe(61_000n)
  })

  it('calls a stranger payment incoming', async () => {
    await dao.recordPendingTx(WALLET, strangerPayingUs, false)
    const tx = await dao.getTransactionByTxid(WALLET, INBOUND)
    expect(tx?.direction).toBe(1)
    expect(tx?.transferAmount).toBe(50_000n)
  })
})
