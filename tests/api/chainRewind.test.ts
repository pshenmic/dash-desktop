import {describe, it, expect, beforeEach} from 'vitest'
import {CreateWalletHandler} from '../../src/main/src/api/wallet/createWallet'
import {TransactionDAO} from '../../src/main/src/database/TransactionDAO'
import {AddressDAO} from '../../src/main/src/database/AddressDAO'
import type {AppliedBlock} from '../../src/main/p2p/types/walletSync'
import {harness, PASSWORD, VALID_SEEDPHRASE} from './harness'

const receiveTo = (walletId: string, height: number, address: string, satoshis: string): AppliedBlock => ({
  walletId,
  height,
  blockHash: `hash-${height}`,
  blockTime: 1_700_000_000,
  txs: [{
    txid: `txid-${height}`,
    raw: new Uint8Array([1, 2, 3]),
    inputs: [],
    outputs: [{vout: 0, address, satoshis, isMine: true}],
  }],
  spends: [],
})

const spendOf = (walletId: string, height: number, prevTxid: string): AppliedBlock => ({
  walletId,
  height,
  blockHash: `hash-${height}`,
  blockTime: 1_700_000_000,
  txs: [{
    txid: `spend-${height}`,
    raw: new Uint8Array([4, 5, 6]),
    inputs: [{vin: 0, prevTxid, prevVout: 0, sequence: 0xffffffff}],
    outputs: [],
  }],
  spends: [{prevTxid, prevVout: 0, spentInTxid: `spend-${height}`}],
})

describe('rewindToHeight', () => {
  let createWalletHandler: CreateWalletHandler
  let transactionDAO: TransactionDAO
  let addressDAO: AddressDAO

  beforeEach(async () => {
    const wired = await harness()
    createWalletHandler = wired.createWalletHandler
    transactionDAO = wired.transactionDAO
    addressDAO = wired.addressDAO
  })

  const newWallet = async (): Promise<{walletId: string; address: string; second: string}> => {
    const walletId = await createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)
    const {receiving} = await addressDAO.getAddressesByWalletId(walletId)
    return {walletId, address: receiving[0].address, second: receiving[1].address}
  }

  it('un-confirms the orphaned blocks and leaves everything at or below the fork alone', async () => {
    const {walletId, address, second} = await newWallet()
    await transactionDAO.applyBlock(receiveTo(walletId, 100, address, '100000'))
    await transactionDAO.applyBlock(receiveTo(walletId, 101, second, '50000'))

    await transactionDAO.rewindToHeight(walletId, 100)

    const kept = await transactionDAO.getTransactionByTxid(walletId, 'txid-100')
    const orphaned = await transactionDAO.getTransactionByTxid(walletId, 'txid-101')

    expect(kept?.blockHeight).toBe(100)
    expect(orphaned?.blockHeight).toBe(0)
  })

  it('puts an orphaned transaction back where the rebroadcast loop will find it', async () => {
    const {walletId, address} = await newWallet()
    await transactionDAO.applyBlock(receiveTo(walletId, 100, address, '100000'))

    expect(await transactionDAO.getPendingTxs(walletId)).toEqual([])

    await transactionDAO.rewindToHeight(walletId, 99)

    const pending = await transactionDAO.getPendingTxs(walletId)
    expect(pending.map(p => p.txid)).toEqual(['txid-100'])
  })

  it('releases a spend the orphaned block recorded, so the coin is spendable again', async () => {
    const {walletId, address} = await newWallet()
    await transactionDAO.applyBlock(receiveTo(walletId, 100, address, '100000'))
    await transactionDAO.applyBlock(spendOf(walletId, 101, 'txid-100'))

    expect(await transactionDAO.getUtxos(walletId)).toEqual([])

    await transactionDAO.rewindToHeight(walletId, 100)

    const utxos = await transactionDAO.getUtxos(walletId)
    expect(utxos).toHaveLength(1)
    expect(utxos[0]).toMatchObject({txid: 'txid-100', vout: 0, satoshis: '100000'})
    expect(await transactionDAO.getBalanceForAddresses(walletId, [address])).toBe(100000n)
  })

  it('keeps a spend that happened at or below the fork', async () => {
    const {walletId, address} = await newWallet()
    await transactionDAO.applyBlock(receiveTo(walletId, 100, address, '100000'))
    await transactionDAO.applyBlock(spendOf(walletId, 101, 'txid-100'))

    await transactionDAO.rewindToHeight(walletId, 101)

    expect(await transactionDAO.getUtxos(walletId)).toEqual([])
  })

  it('drops the scan cursor to the fork so the replacement blocks are re-covered', async () => {
    const {walletId, address} = await newWallet()
    await transactionDAO.applyBlock(receiveTo(walletId, 100, address, '100000'))
    await transactionDAO.applyBlock(receiveTo(walletId, 120, address, '10000'))
    expect(await transactionDAO.getCursor(walletId)).toBe(120)

    await transactionDAO.rewindToHeight(walletId, 110)

    expect(await transactionDAO.getCursor(walletId)).toBe(110)
  })

  it('leaves a cursor already below the fork where it is', async () => {
    const {walletId, address} = await newWallet()
    await transactionDAO.applyBlock(receiveTo(walletId, 100, address, '100000'))

    await transactionDAO.rewindToHeight(walletId, 150)

    expect(await transactionDAO.getCursor(walletId)).toBe(100)
  })

  it('leaves the receiving address marked used — it was revealed either way', async () => {
    const {walletId, address} = await newWallet()
    await transactionDAO.applyBlock(receiveTo(walletId, 100, address, '100000'))

    await transactionDAO.rewindToHeight(walletId, 99)

    const {receiving} = await addressDAO.getAddressesByWalletId(walletId)
    expect(receiving.find(a => a.address === address)?.isUsed).toBe(true)
  })
})
