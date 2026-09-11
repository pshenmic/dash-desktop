import {describe, it, expect} from 'vitest'
import {P2PWalletProvider} from '../../src/main/src/providers/P2PWalletProvider'
import {TransactionDAO} from '../../src/main/src/database/TransactionDAO'
import {AddressDAO} from '../../src/main/src/database/AddressDAO'
import {WalletSyncService} from '../../src/main/src/services/core/WalletSyncService'
import {CorePrevOutService} from '../../src/main/src/services/core/CorePrevOutService'
import type {Transaction} from '../../src/main/src/types/Transaction'

const TIP = 2_300_010

// The store writes 0 because it has no tip to count against.
const stored = (txid: string, blockHeight: number): Transaction => ({
  address: 'yAddr',
  direction: 1,
  inAmount: 0n,
  outAmount: 1_000n,
  transferAmount: 1_000n,
  usdAmount: '0.0',
  date: new Date(1_700_000_000_000),
  size: 200,
  blockHeight,
  status: 'Pending',
  walletId: 'w1',
  confirmations: 0,
  txid,
  vin: [],
  vout: [],
  instantLocked: false,
  chainlocked: false,
  isLocal: false,
})

const provider = (transactions: Transaction[], tipHeight = TIP): P2PWalletProvider => {
  const transactionDAO = {
    getTransactionsByWallet: async () => transactions,
    getTransactionByTxid: async (_walletId: string, txid: string) =>
      transactions.find(tx => tx.txid === txid),
  } as unknown as TransactionDAO
  const walletSyncService = {getStatus: () => ({tipHeight})} as unknown as WalletSyncService
  const prevOutService = {resolveTransaction: async () => undefined} as unknown as CorePrevOutService

  return new P2PWalletProvider(transactionDAO, 'w1', walletSyncService, {} as AddressDAO, prevOutService)
}

describe('confirmation counts on locally stored transactions', () => {
  it('counts the wallet list against the header tip', async () => {
    const [recent, older] = await provider([stored('a', TIP), stored('b', 2_300_000)])
      .getWalletTransactions()

    expect(recent.confirmations).toBe(1)
    expect(older.confirmations).toBe(11)
  })

  it('counts the detail view the same way', async () => {
    const tx = await provider([stored('a', 2_300_005)]).getTransactionByHash('a')

    expect(tx.confirmations).toBe(6)
  })

  it('leaves an unconfirmed transaction at zero', async () => {
    const [tx] = await provider([stored('a', 0)]).getWalletTransactions()

    expect(tx.confirmations).toBe(0)
  })

  // Every count would otherwise go negative and read as more confirmed than the
  // tip that is actually verified.
  it('answers zero while no headers have been validated yet', async () => {
    const [tx] = await provider([stored('a', 2_300_000)], 0).getWalletTransactions()

    expect(tx.confirmations).toBe(0)
  })
})
