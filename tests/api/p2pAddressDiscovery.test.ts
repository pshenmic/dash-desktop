import {describe, it, expect, beforeEach} from 'vitest'
import {CreateWalletHandler} from '../../src/main/src/api/wallet/createWallet'
import {CoreDiscoveryService} from '../../src/main/src/services/core/CoreDiscoveryService'
import {TransactionDAO} from '../../src/main/src/database/TransactionDAO'
import {AddressDAO} from '../../src/main/src/database/AddressDAO'
import {ADDRESS_LOOKAHEAD} from '../../src/main/src/constants'
import type {AppliedBlock} from '../../src/main/p2p/types/walletSync'
import {harness, PASSWORD, VALID_SEEDPHRASE} from './harness'

const receiveTo = (walletId: string, height: number, address: string): AppliedBlock => ({
  walletId,
  height,
  blockHash: `hash-${height}`,
  blockTime: 1_700_000_000,
  txs: [{
    txid: `txid-${height}`,
    raw: new Uint8Array([1, 2, 3]),
    inputs: [],
    outputs: [{vout: 0, address, satoshis: '100000', isMine: true}],
  }],
  spends: [],
})

describe('p2p address discovery', () => {
  let discovery: CoreDiscoveryService
  let createWalletHandler: CreateWalletHandler
  let transactionDAO: TransactionDAO
  let addressDAO: AddressDAO

  beforeEach(async () => {
    const wired = await harness()
    discovery = wired.coreDiscoveryService
    createWalletHandler = wired.createWalletHandler
    transactionDAO = wired.transactionDAO
    addressDAO = wired.addressDAO
  })

  it('reports an address as used once a block paying it is applied', async () => {
    const walletId = await createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)
    const {receiving} = await addressDAO.getAddressesByWalletId(walletId)
    const paid = receiving[3].address
    const all = receiving.map(a => a.address)

    expect(await transactionDAO.getUsedAddresses(walletId, all)).toEqual([])

    await transactionDAO.applyBlock(receiveTo(walletId, 100, paid))

    expect(await transactionDAO.getUsedAddresses(walletId, all)).toEqual([paid])
  })

  it('counts an output paying an address the wallet has not derived yet', async () => {
    const walletId = await createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)
    const {receiving} = await addressDAO.getAddressesByWalletId(walletId)
    const foreign = receiving[0].address

    await transactionDAO.applyBlock({
      ...receiveTo(walletId, 100, foreign),
      txs: [{
        txid: 'txid-100',
        raw: new Uint8Array([1, 2, 3]),
        inputs: [],
        outputs: [{vout: 0, address: foreign, satoshis: '100000', isMine: false}],
      }],
    })

    expect(await transactionDAO.getUsedAddresses(walletId, [foreign])).toEqual([foreign])
  })

  it('extends the receiving chain past a used address at the gap edge', async () => {
    const walletId = await createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)
    const before = await addressDAO.getAddressesByWalletId(walletId)
    expect(before.receiving).toHaveLength(ADDRESS_LOOKAHEAD)

    const last = before.receiving[ADDRESS_LOOKAHEAD - 1]
    await transactionDAO.applyBlock(receiveTo(walletId, 100, last.address))

    await discovery.discoverCoreAddresses(walletId)

    const after = await addressDAO.getAddressesByWalletId(walletId)
    expect(after.receiving).toHaveLength(last.index + 1 + ADDRESS_LOOKAHEAD)
    expect(after.receiving.find(a => a.address === last.address)?.isUsed).toBe(true)
    expect(after.change).toHaveLength(ADDRESS_LOOKAHEAD)
  })

  it('extends past an address whose only output was stored is_mine=false', async () => {
    const walletId = await createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)
    const before = await addressDAO.getAddressesByWalletId(walletId)
    await transactionDAO.applyBlock(receiveTo(walletId, 100, before.receiving[ADDRESS_LOOKAHEAD - 1].address))
    await discovery.discoverCoreAddresses(walletId)

    const extended = await addressDAO.getAddressesByWalletId(walletId)
    const missed = extended.receiving[ADDRESS_LOOKAHEAD + 5]
    expect(missed.isUsed).toBe(false)

    await transactionDAO.applyBlock({
      walletId,
      height: 200,
      blockHash: 'hash-200',
      blockTime: 1_700_000_000,
      txs: [{
        txid: 'txid-200',
        raw: new Uint8Array([1, 2, 3]),
        inputs: [],
        outputs: [
          {vout: 0, address: extended.receiving[5].address, satoshis: '100000', isMine: true},
          {vout: 1, address: missed.address, satoshis: '50000', isMine: false},
        ],
      }],
      spends: [],
    })

    await discovery.discoverCoreAddresses(walletId)

    const after = await addressDAO.getAddressesByWalletId(walletId)
    expect(after.receiving.find(a => a.address === missed.address)?.isUsed).toBe(true)
    expect(after.receiving).toHaveLength(missed.index + 1 + ADDRESS_LOOKAHEAD)
  })

  it('adds nothing when no address has been paid', async () => {
    const walletId = await createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)

    await discovery.discoverCoreAddresses(walletId)

    const after = await addressDAO.getAddressesByWalletId(walletId)
    expect(after.receiving).toHaveLength(ADDRESS_LOOKAHEAD)
    expect(after.change).toHaveLength(ADDRESS_LOOKAHEAD)
  })
})