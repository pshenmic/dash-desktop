import {describe, it, expect, beforeEach, vi} from 'vitest'
import {Output, Transaction as SDKTransaction} from 'dash-core-sdk'
import {CreateWalletHandler} from '../../src/main/src/api/wallet/createWallet'
import {CorePrevOutService} from '../../src/main/src/services/core/CorePrevOutService'
import {TransactionDAO} from '../../src/main/src/database/TransactionDAO'
import {AddressDAO} from '../../src/main/src/database/AddressDAO'
import {WalletDAO} from '../../src/main/src/database/WalletDAO'
import type {AppliedBlock} from '../../src/main/p2p/types/walletSync'
import {PREVOUT_RESOLVE_BATCH} from '../../src/main/src/constants/chain'
import {harness, PASSWORD, VALID_SEEDPHRASE} from './harness'

const {getTransaction} = vi.hoisted(() => ({getTransaction: vi.fn()}))
vi.mock('../../src/main/src/utils/coreSDK', () => ({coreSDK: () => ({getTransaction})}))

const SENDER = 'yaJsLTUumcbPca64NNEPwXZUp6wp39rYWM'

const parent = (satoshis: bigint, outputs = 1): {transaction: Uint8Array} => ({
  transaction: new SDKTransaction(
    [],
    Array.from({length: outputs}, () => Output.createP2PKH(satoshis, SENDER)),
  ).bytes(),
})

// One transaction per parent, so the number of transactions is what decides how
// many pages a drain takes.
const block = (walletId: string, address: string, count: number): AppliedBlock => ({
  walletId,
  height: 1_537_826,
  blockHash: 'hash-1537826',
  blockTime: 1_700_000_000,
  txs: Array.from({length: count}, (_, i) => ({
    txid: `tx-${String(i).padStart(3, '0')}`,
    raw: new Uint8Array([1]),
    inputs: [{vin: 0, prevTxid: `parent-${String(i).padStart(3, '0')}`, prevVout: 0, sequence: 0xffffffff}],
    outputs: [{vout: 0, address, satoshis: '1000', isMine: true}],
  })),
  spends: [],
})

describe('prev-out resolution service', () => {
  let createWalletHandler: CreateWalletHandler
  let transactionDAO: TransactionDAO
  let addressDAO: AddressDAO
  let walletDAO: WalletDAO
  let prevOutService: CorePrevOutService

  beforeEach(async () => {
    getTransaction.mockReset()
    const wired = await harness()
    createWalletHandler = wired.createWalletHandler
    transactionDAO = wired.transactionDAO
    addressDAO = wired.addressDAO
    walletDAO = wired.walletDAO
    prevOutService = wired.prevOutService
  })

  const newWallet = async (count: number): Promise<{walletId: string; address: string}> => {
    const walletId = await createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)
    const {receiving} = await addressDAO.getAddressesByWalletId(walletId)
    const address = receiving[0].address
    await transactionDAO.applyBlock(block(walletId, address, count))
    return {walletId, address}
  }

  it('drains a backlog larger than one page in a single pass', async () => {
    const count = PREVOUT_RESOLVE_BATCH + 10
    const {walletId} = await newWallet(count)
    getTransaction.mockResolvedValue(parent(100_000n))

    await prevOutService.resolveBacklog(walletId)

    expect(getTransaction).toHaveBeenCalledTimes(count)
    expect(await transactionDAO.getUnresolvedInputs(walletId, count)).toEqual([])
    const tx = await transactionDAO.getTransactionByTxid(walletId, 'tx-000')
    expect(tx?.vin[0]).toMatchObject({addr: SENDER, value: '0.00100000'})
  })

  // The write-off is on the row, not in the process, so a restart does not send
  // the wallet back to DAPI for every dead parent it already asked about.
  it('stops asking for a parent that answered without the output', async () => {
    const {walletId} = await newWallet(1)
    // vout 0 is what the input names; a parent with no outputs cannot answer it.
    getTransaction.mockResolvedValue(parent(100_000n, 0))

    await prevOutService.resolveBacklog(walletId)
    await new CorePrevOutService(walletDAO, transactionDAO).resolveBacklog(walletId)

    expect(getTransaction).toHaveBeenCalledTimes(1)
    expect(await transactionDAO.getUnresolvedInputs(walletId, 10)).toEqual([])
    // Written off, not resolved: the input still has nothing to show.
    const tx = await transactionDAO.getTransactionByTxid(walletId, 'tx-000')
    expect(tx?.vin[0]).toMatchObject({addr: '', value: '0.00000000'})
  })

  it('asks again for a parent that never answered', async () => {
    const {walletId} = await newWallet(1)
    getTransaction.mockRejectedValueOnce(new Error('no evonode answered'))

    await prevOutService.resolveBacklog(walletId)
    expect(await transactionDAO.getUnresolvedInputs(walletId, 10)).toHaveLength(1)

    getTransaction.mockResolvedValue(parent(100_000n))
    await prevOutService.resolveBacklog(walletId)

    expect(getTransaction).toHaveBeenCalledTimes(2)
    expect(await transactionDAO.getUnresolvedInputs(walletId, 10)).toEqual([])
  })

  it('resolves only the opened transaction on demand', async () => {
    const {walletId} = await newWallet(3)
    getTransaction.mockResolvedValue(parent(100_000n))

    await prevOutService.resolveTransaction(walletId, 'tx-001')

    expect(getTransaction).toHaveBeenCalledTimes(1)
    expect(getTransaction).toHaveBeenCalledWith('parent-001')
    expect(await transactionDAO.getUnresolvedInputs(walletId, 10)).toEqual([
      {txid: 'tx-000', prevTxid: 'parent-000', prevVout: 0},
      {txid: 'tx-002', prevTxid: 'parent-002', prevVout: 0},
    ])
  })
})
