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

describe('getAddressInfos', () => {
  let createWalletHandler: CreateWalletHandler
  let transactionDAO: TransactionDAO
  let addressDAO: AddressDAO

  beforeEach(async () => {
    const wired = await harness()
    createWalletHandler = wired.createWalletHandler
    transactionDAO = wired.transactionDAO
    addressDAO = wired.addressDAO
  })

  it('answers for every address asked for, in order, including untouched ones', async () => {
    const walletId = await createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)
    const {receiving} = await addressDAO.getAddressesByWalletId(walletId)
    const asked = receiving.slice(0, 5).map(a => a.address)

    await transactionDAO.applyBlock(receiveTo(walletId, 100, asked[3], '100000'))

    const infos = await transactionDAO.getAddressInfos(walletId, asked)

    expect(infos.map(i => i.address)).toEqual(asked)
    expect(infos[3]).toEqual({address: asked[3], balance: 100000n, txCount: 1})
    expect(infos.filter((_, i) => i !== 3)).toEqual(
      asked.filter((_, i) => i !== 3).map(address => ({address, balance: 0n, txCount: 0}))
    )
  })

  it('sums multiple unspent outputs and drops the spent one from the balance', async () => {
    const walletId = await createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)
    const {receiving} = await addressDAO.getAddressesByWalletId(walletId)
    const address = receiving[0].address

    await transactionDAO.applyBlock(receiveTo(walletId, 100, address, '100000'))
    await transactionDAO.applyBlock(receiveTo(walletId, 101, address, '50000'))

    const [funded] = await transactionDAO.getAddressInfos(walletId, [address])
    expect(funded).toEqual({address, balance: 150000n, txCount: 2})

    await transactionDAO.applyBlock({
      walletId,
      height: 102,
      blockHash: 'hash-102',
      blockTime: 1_700_000_000,
      txs: [{
        txid: 'txid-spend',
        raw: new Uint8Array([4, 5, 6]),
        inputs: [{vin: 0, prevTxid: 'txid-100', prevVout: 0, sequence: 0xffffffff}],
        outputs: [],
      }],
      spends: [{prevTxid: 'txid-100', prevVout: 0, spentInTxid: 'txid-spend'}],
    })

    const [spent] = await transactionDAO.getAddressInfos(walletId, [address])
    expect(spent.balance).toBe(50000n)
  })

  it('counts the same transactions getTransactionsByAddress returns', async () => {
    const walletId = await createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)
    const {receiving} = await addressDAO.getAddressesByWalletId(walletId)
    const address = receiving[0].address

    await transactionDAO.applyBlock(receiveTo(walletId, 100, address, '100000'))
    await transactionDAO.applyBlock({
      walletId,
      height: 101,
      blockHash: 'hash-101',
      blockTime: 1_700_000_000,
      txs: [{
        txid: 'txid-spend',
        raw: new Uint8Array([4, 5, 6]),
        inputs: [{vin: 0, prevTxid: 'txid-100', prevVout: 0, sequence: 0xffffffff}],
        outputs: [{vout: 0, address: receiving[1].address, satoshis: '90000', isMine: true}],
      }],
      spends: [{prevTxid: 'txid-100', prevVout: 0, spentInTxid: 'txid-spend'}],
    })

    const [info] = await transactionDAO.getAddressInfos(walletId, [address])
    const txs = await transactionDAO.getTransactionsByAddress(walletId, address)

    expect(info.txCount).toBe(txs.length)
    expect(info.txCount).toBe(2)
  })

  it('returns nothing for an empty address list', async () => {
    const walletId = await createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)
    expect(await transactionDAO.getAddressInfos(walletId, [])).toEqual([])
  })
})
