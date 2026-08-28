import {describe, it, expect, beforeEach} from 'vitest'
import {CreateWalletHandler} from '../../src/main/src/api/wallet/createWallet'
import {TransactionDAO} from '../../src/main/src/database/TransactionDAO'
import {AddressDAO} from '../../src/main/src/database/AddressDAO'
import type {AppliedBlock} from '../../src/main/p2p/types/walletSync'
import {COINBASE_PREV_TXID} from '../../src/main/src/constants/chain'
import {harness, PASSWORD, VALID_SEEDPHRASE} from './harness'

const SENDER = 'yaJsLTUumcbPca64NNEPwXZUp6wp39rYWM'
const PAGE = 50

// A payment from somebody else: we own the output, and the two inputs spend
// outputs the local store has never seen.
const incoming = (walletId: string, address: string): AppliedBlock => ({
  walletId,
  height: 1_537_826,
  blockHash: 'hash-1537826',
  blockTime: 1_700_000_000,
  txs: [{
    txid: 'incoming-tx',
    raw: new Uint8Array([1, 2, 3]),
    inputs: [
      {vin: 0, prevTxid: 'parent-a', prevVout: 1, sequence: 0xffffffff},
      {vin: 1, prevTxid: 'parent-b', prevVout: 0, sequence: 0xffffffff},
    ],
    outputs: [{vout: 0, address, satoshis: '99999738', isMine: true}],
  }],
  spends: [],
})

const secondIncoming = (walletId: string, address: string): AppliedBlock => ({
  walletId,
  height: 1_537_830,
  blockHash: 'hash-1537830',
  blockTime: 1_700_000_400,
  txs: [{
    txid: 'later-tx',
    raw: new Uint8Array([1]),
    inputs: [{vin: 0, prevTxid: 'parent-d', prevVout: 2, sequence: 0xffffffff}],
    outputs: [{vout: 0, address, satoshis: '1000', isMine: true}],
  }],
  spends: [],
})

const coinbase = (walletId: string, address: string): AppliedBlock => ({
  walletId,
  height: 1_537_827,
  blockHash: 'hash-1537827',
  blockTime: 1_700_000_100,
  txs: [{
    txid: 'coinbase-tx',
    raw: new Uint8Array([4, 5, 6]),
    inputs: [{vin: 0, prevTxid: COINBASE_PREV_TXID, prevVout: 0xffffffff, sequence: 0xffffffff}],
    outputs: [{vout: 0, address, satoshis: '500000000', isMine: true}],
  }],
  spends: [],
})

describe('prev-out resolution', () => {
  let createWalletHandler: CreateWalletHandler
  let transactionDAO: TransactionDAO
  let addressDAO: AddressDAO

  beforeEach(async () => {
    const wired = await harness()
    createWalletHandler = wired.createWalletHandler
    transactionDAO = wired.transactionDAO
    addressDAO = wired.addressDAO
  })

  const newWallet = async (): Promise<{walletId: string; address: string}> => {
    const walletId = await createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)
    const {receiving} = await addressDAO.getAddressesByWalletId(walletId)
    return {walletId, address: receiving[0].address}
  }

  it('reports every input whose previous output is not one of ours', async () => {
    const {walletId, address} = await newWallet()
    await transactionDAO.applyBlock(incoming(walletId, address))

    const pending = await transactionDAO.getUnresolvedInputs(walletId, PAGE)

    expect(pending).toEqual([
      {txid: 'incoming-tx', prevTxid: 'parent-a', prevVout: 1},
      {txid: 'incoming-tx', prevTxid: 'parent-b', prevVout: 0},
    ])
  })

  // Cutting the batch on a transaction boundary only works if a transaction's
  // inputs arrive contiguously and in vin order.
  it('returns each transaction\'s inputs contiguously and in vin order', async () => {
    const {walletId, address} = await newWallet()
    await transactionDAO.applyBlock(incoming(walletId, address))
    await transactionDAO.applyBlock({
      walletId,
      height: 1_537_829,
      blockHash: 'hash-1537829',
      blockTime: 1_700_000_300,
      txs: [{
        txid: 'another-tx',
        raw: new Uint8Array([9]),
        // Deliberately out of vin order, and sharing a parent with incoming-tx.
        inputs: [
          {vin: 1, prevTxid: 'parent-c', prevVout: 0, sequence: 0xffffffff},
          {vin: 0, prevTxid: 'parent-a', prevVout: 3, sequence: 0xffffffff},
        ],
        outputs: [{vout: 0, address, satoshis: '1000', isMine: true}],
      }],
      spends: [],
    })

    const pending = await transactionDAO.getUnresolvedInputs(walletId, PAGE)

    expect(pending).toEqual([
      {txid: 'another-tx', prevTxid: 'parent-a', prevVout: 3},
      {txid: 'another-tx', prevTxid: 'parent-c', prevVout: 0},
      {txid: 'incoming-tx', prevTxid: 'parent-a', prevVout: 1},
      {txid: 'incoming-tx', prevTxid: 'parent-b', prevVout: 0},
    ])
  })

  // The limit counts transactions, not rows: a page cutting between two inputs
  // of one transaction is what the whole-transaction rule exists to prevent.
  it('pages by transaction and walks past the page it already took', async () => {
    const {walletId, address} = await newWallet()
    await transactionDAO.applyBlock(incoming(walletId, address))
    await transactionDAO.applyBlock(secondIncoming(walletId, address))

    const first = await transactionDAO.getUnresolvedInputs(walletId, 1)
    expect(first).toEqual([
      {txid: 'incoming-tx', prevTxid: 'parent-a', prevVout: 1},
      {txid: 'incoming-tx', prevTxid: 'parent-b', prevVout: 0},
    ])

    const second = await transactionDAO.getUnresolvedInputs(walletId, 1, 'incoming-tx')
    expect(second).toEqual([{txid: 'later-tx', prevTxid: 'parent-d', prevVout: 2}])

    expect(await transactionDAO.getUnresolvedInputs(walletId, 1, 'later-tx')).toEqual([])
  })

  it('answers for a single transaction, for the view that opened it', async () => {
    const {walletId, address} = await newWallet()
    await transactionDAO.applyBlock(incoming(walletId, address))
    await transactionDAO.applyBlock(secondIncoming(walletId, address))

    expect(await transactionDAO.getUnresolvedInputsForTx(walletId, 'later-tx')).toEqual([
      {prevTxid: 'parent-d', prevVout: 2},
    ])

    await transactionDAO.recordPrevOuts(walletId, [
      {prevTxid: 'parent-d', prevVout: 2, address: SENDER, satoshis: '1000'},
    ])

    expect(await transactionDAO.getUnresolvedInputsForTx(walletId, 'later-tx')).toEqual([])
  })

  it('leaves out inputs written off as missing', async () => {
    const {walletId, address} = await newWallet()
    await transactionDAO.applyBlock(incoming(walletId, address))

    await transactionDAO.markPrevOutsMissing(walletId, [{prevTxid: 'parent-a', prevVout: 1}])

    expect(await transactionDAO.getUnresolvedInputs(walletId, PAGE)).toEqual([
      {txid: 'incoming-tx', prevTxid: 'parent-b', prevVout: 0},
    ])
    expect(await transactionDAO.getUnresolvedInputsForTx(walletId, 'incoming-tx')).toEqual([
      {prevTxid: 'parent-b', prevVout: 0},
    ])
  })

  it('leaves out coinbase inputs and outputs we already hold', async () => {
    const {walletId, address} = await newWallet()
    await transactionDAO.applyBlock(coinbase(walletId, address))
    await transactionDAO.applyBlock({
      walletId,
      height: 1_537_828,
      blockHash: 'hash-1537828',
      blockTime: 1_700_000_200,
      txs: [{
        txid: 'our-spend',
        raw: new Uint8Array([7, 8, 9]),
        inputs: [{vin: 0, prevTxid: 'coinbase-tx', prevVout: 0, sequence: 0xffffffff}],
        outputs: [],
      }],
      spends: [{prevTxid: 'coinbase-tx', prevVout: 0, spentInTxid: 'our-spend'}],
    })

    expect(await transactionDAO.getUnresolvedInputs(walletId, PAGE)).toEqual([])
  })

  it('fills the sender address and value into the transaction once recorded', async () => {
    const {walletId, address} = await newWallet()
    await transactionDAO.applyBlock(incoming(walletId, address))

    const before = await transactionDAO.getTransactionByTxid(walletId, 'incoming-tx')
    expect(before?.vin.map(input => [input.addr, input.value])).toEqual([
      ['', '0.00000000'],
      ['', '0.00000000'],
    ])

    await transactionDAO.recordPrevOuts(walletId, [
      {prevTxid: 'parent-a', prevVout: 1, address: SENDER, satoshis: '100000000'},
      {prevTxid: 'parent-b', prevVout: 0, address: '', satoshis: '9738'},
    ])

    const after = await transactionDAO.getTransactionByTxid(walletId, 'incoming-tx')
    expect(after?.vin.map(input => [input.addr, input.value])).toEqual([
      [SENDER, '1.00000000'],
      ['', '0.00009738'],
    ])
    // Resolution describes the inputs; it must not make them ours.
    expect(after?.inAmount).toBe(0n)
    expect(after?.direction).toBe(1)
    expect(after?.transferAmount).toBe(99999738n)
    expect(await transactionDAO.getUnresolvedInputs(walletId, PAGE)).toEqual([])
  })

  it('does not let a resolved sender output reach the balance or the utxo set', async () => {
    const {walletId, address} = await newWallet()
    await transactionDAO.applyBlock(incoming(walletId, address))
    await transactionDAO.recordPrevOuts(walletId, [
      {prevTxid: 'parent-a', prevVout: 1, address: SENDER, satoshis: '100000000'},
      {prevTxid: 'parent-b', prevVout: 0, address: '', satoshis: '9738'},
    ])

    expect(await transactionDAO.getBalanceForAddresses(walletId, [address, SENDER])).toBe(99999738n)
    expect(await transactionDAO.getUtxos(walletId)).toHaveLength(1)
  })
})
