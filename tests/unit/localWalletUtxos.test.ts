import { describe, expect, it } from 'vitest'
import type { Transaction, TransactionOutput, WalletAddressDto } from '../../src/renderer/src/api/types'
import { localWalletUtxos } from '../../src/renderer/src/utils/localWalletUtxos'

function address(value: string, walletId = 'wallet-a'): WalletAddressDto {
  return {walletId, address: value, accountId: 0, derivationPath: '', index: 0,
    isChange: 0, isUsed: true, balance: 0n, txCount: 1, label: null, usdBalance: null}
}

function output(overrides: Partial<TransactionOutput> = {}): TransactionOutput {
  return {value: '1', n: 0, address: 'receiving', spentTxId: '', spentIndex: 0, spentHeight: 0, ...overrides}
}

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {walletId: 'wallet-a', txid: 'tx', address: 'receiving', direction: 1,
    inAmount: 0n, outAmount: 0n, transferAmount: 0n, usdAmount: '', date: new Date(0),
    size: 0, blockHeight: 10, status: 'Locked', confirmations: 1,
    vin: [], vout: [output()], instantLocked: false, chainlocked: false, isLocal: false, ...overrides}
}

const addresses = {receiving: [address('receiving')], change: [address('change')]}

describe('locally saved P2P UTXOs', () => {
  it('includes owned receiving/change outputs and parses DASH decimals as exact duffs', () => {
    const result = localWalletUtxos('wallet-a', [transaction({vout: [
      output({value: '0.00000001'}),
      output({n: 2, address: 'change', value: '90071992.54740993'}),
      output({n: 3, address: 'external'}),
    ]})], addresses)
    expect(result).toEqual([
      {txid: 'tx', vout: 0, address: 'receiving', satoshis: 1n, height: 10, timestamp: new Date(0), confirmations: 1},
      {txid: 'tx', vout: 2, address: 'change', satoshis: 9_007_199_254_740_993n, height: 10, timestamp: new Date(0), confirmations: 1},
    ])
  })

  it('excludes confirmed and mempool spends while retaining unspent mempool receipts', () => {
    const result = localWalletUtxos('wallet-a', [transaction({vout: [
      output({spentTxId: 'confirmed-spend', spentHeight: 20}),
      output({n: 1, spentTxId: 'pending-spend', spentHeight: 0}),
    ]}), transaction({txid: 'incoming', blockHeight: 0, status: 'Pending', date: new Date('2026-09-11T09:15:00Z'), confirmations: 0})], addresses)
    expect(result).toEqual([{txid: 'incoming', vout: 0, address: 'receiving', satoshis: 100_000_000n, height: 0, timestamp: new Date('2026-09-11T09:15:00Z'), confirmations: 0}])
  })

  it('deduplicates outpoints and never resurrects a spent duplicate', () => {
    const unspent = transaction()
    const spent = transaction({vout: [output({spentTxId: 'spend'})]})
    expect(localWalletUtxos('wallet-a', [unspent, unspent], addresses)).toHaveLength(1)
    expect(localWalletUtxos('wallet-a', [spent, unspent], addresses)).toEqual([])
    expect(localWalletUtxos('wallet-a', [unspent, spent], addresses)).toEqual([])
  })

  it('isolates transactions and addresses by wallet even when address strings overlap', () => {
    const result = localWalletUtxos('wallet-a', [
      transaction({walletId: 'wallet-b'}),
      transaction({txid: 'own-tx', vout: [output({address: 'foreign'})]}),
    ], {receiving: [...addresses.receiving, address('foreign', 'wallet-b')], change: []})
    expect(result).toEqual([])
    expect(localWalletUtxos('wallet-b', [transaction()], addresses)).toEqual([])
    expect(localWalletUtxos('wallet-a', [], addresses)).toEqual([])
  })
})
