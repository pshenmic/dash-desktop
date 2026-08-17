import {describe, it, expect} from 'vitest'
import {utils as sdkUtils} from 'dash-core-sdk'
import {WatchSet} from '../../src/main/p2p/WatchSet'
import type {WalletSyncUtxo, WatchAddress} from '../../src/main/p2p/types/walletSync'
import type {Block} from 'dash-core-sdk'

const GAP_LIMIT = 20

const addressAt = (n: number, isChange = false): string =>
  sdkUtils.publicKeyHashToAddress(new Uint8Array(20).fill(isChange ? n + 128 : n), 'testnet')

const watched = (n: number, over: Partial<WatchAddress> = {}): WatchAddress => {
  const isChange = over.isChange ?? false
  return {address: addressAt(n, isChange), index: n, isChange, isUsed: false, ...over}
}

// A gap limit is per chain, so a set that exercises one needs the other stocked.
const changeChain = (count: number): WatchAddress[] =>
  Array.from({length: count}, (_, i) => watched(i, {isChange: true}))

const txidAt = (n: number): string => n.toString(16).padStart(64, '0')

const utxo = (n: number, address: string): WalletSyncUtxo => ({
  txid: txidAt(n), vout: 0, satoshis: '100000', address, height: n,
})

// Only the surface WatchSet.applyBlock reads.
const block = (
  txs: Array<{
    txid: string
    inputs?: Array<{txId: string; vOut: number}>
    outputs?: Array<{address: string | null; satoshis: number}>
  }>,
): Block => ({
  hash: () => 'block-hash',
  blockHeader: {time: 1_760_000_000},
  txs: txs.map(tx => ({
    hash: () => tx.txid,
    bytes: () => new Uint8Array([1, 2, 3]),
    inputs: (tx.inputs ?? []).map(i => ({txId: i.txId, vOut: i.vOut, sequence: 0xffffffff})),
    outputs: (tx.outputs ?? []).map(o => ({
      satoshis: o.satoshis,
      getAddress: () => o.address,
    })),
  })),
}) as unknown as Block

describe('WatchSet gap tracking', () => {
  it('reports a chain exhausted when unused addresses run below the gap limit', () => {
    const set = new WatchSet('testnet', GAP_LIMIT, [
      watched(1, {isUsed: true}),
      ...Array.from({length: 20}, (_, i) => watched(i + 2)),
      ...changeChain(GAP_LIMIT),
    ])

    expect(set.exhaustedChain()).toBeNull()

    // A use at the top index leaves nothing spare above it.
    set.applyBlock(block([{txid: txidAt(99), outputs: [{address: addressAt(21), satoshis: 5}]}]), 10)

    expect(set.exhaustedChain()).toBe('receiving')
  })

  it('tracks receiving and change chains separately', () => {
    const set = new WatchSet('testnet', 2, [
      watched(1, {isUsed: true}),
      watched(2), watched(3), watched(4),
      watched(5, {isChange: true, isUsed: true}),
      watched(6, {isChange: true}),
    ])

    expect(set.exhaustedChain()).toBe('change')
    expect(set.gapState('receiving')).toEqual({maxIndex: 4, lastUsed: 1})
    expect(set.gapState('change')).toEqual({maxIndex: 6, lastUsed: 5})
  })

  it('ignores an address it already holds', () => {
    const set = new WatchSet('testnet', GAP_LIMIT, [watched(1)])

    expect(set.add(watched(1))).toBe(false)
    expect(set.add(watched(2))).toBe(true)
    expect(set.size).toBe(2)
  })
})

describe('WatchSet block matching', () => {
  it('records an output paying a watched address', () => {
    const set = new WatchSet('testnet', GAP_LIMIT, [watched(1)])

    const match = set.applyBlock(
      block([{txid: txidAt(7), outputs: [{address: addressAt(1), satoshis: 4200}]}]),
      11,
    )

    expect(match?.txs).toHaveLength(1)
    expect(match!.txs[0]!.outputs[0]!.isMine).toBe(true)
    expect(set.utxoCount).toBe(1)
    expect(set.totalSatoshis()).toBe(4200n)
  })

  // The reason the match set carries outpoints as well as scripts: this tx pays
  // no address of ours, so nothing but the spent outpoint identifies it.
  it('catches a transaction that only spends from us', () => {
    const set = new WatchSet('testnet', GAP_LIMIT, [watched(1)])
    set.setUtxos([utxo(7, addressAt(1))])

    const match = set.applyBlock(
      block([{
        txid: txidAt(8),
        inputs: [{txId: txidAt(7), vOut: 0}],
        outputs: [{address: addressAt(9), satoshis: 90000}],
      }]),
      12,
    )

    expect(match?.spends).toEqual([{prevTxid: txidAt(7), prevVout: 0, spentInTxid: txidAt(8)}])
    expect(set.utxoCount).toBe(0)
  })

  it('returns null for a block touching nothing of ours', () => {
    const set = new WatchSet('testnet', GAP_LIMIT, [watched(1)])

    const match = set.applyBlock(
      block([{txid: txidAt(3), outputs: [{address: addressAt(9), satoshis: 10}]}]),
      13,
    )

    expect(match).toBeNull()
  })

  it('keeps a non-standard output in the tx it records without claiming it', () => {
    const set = new WatchSet('testnet', GAP_LIMIT, [watched(1)])

    const match = set.applyBlock(
      block([{
        txid: txidAt(4),
        outputs: [{address: null, satoshis: 0}, {address: addressAt(1), satoshis: 77}],
      }]),
      14,
    )

    expect(match!.txs[0]!.outputs).toHaveLength(2)
    expect(match!.txs[0]!.outputs[0]).toMatchObject({address: null, isMine: false})
    expect(match!.txs[0]!.outputs[1]!.isMine).toBe(true)
  })
})

// The native FilterMatcher caches a copy of `items`, keyed on this. A revision
// that fails to move leaves the scan matching against a stale set.
describe('WatchSet.revision', () => {
  it('moves when an address is added, and not when one is a duplicate', () => {
    const set = new WatchSet('testnet', GAP_LIMIT, [])
    const before = set.revision

    expect(set.add(watched(1))).toBe(true)
    expect(set.revision).toBeGreaterThan(before)

    const afterAdd = set.revision
    expect(set.add(watched(1))).toBe(false)
    expect(set.revision).toBe(afterAdd)
  })

  it('moves when the utxo snapshot is replaced', () => {
    const set = new WatchSet('testnet', GAP_LIMIT, [watched(1)])
    const before = set.revision

    set.setUtxos([utxo(7, addressAt(1))])

    expect(set.revision).toBeGreaterThan(before)
  })

  // applyBlock appends an outpoint for each output it claims.
  it('moves when a matched block adds an outpoint', () => {
    const set = new WatchSet('testnet', GAP_LIMIT, [watched(1)])
    const before = set.revision

    set.applyBlock(block([{txid: txidAt(7), outputs: [{address: addressAt(1), satoshis: 10}]}]), 11)

    expect(set.revision).toBeGreaterThan(before)
    expect(set.items).toHaveLength(2)
  })

  it('stays put for a block that touches nothing of ours', () => {
    const set = new WatchSet('testnet', GAP_LIMIT, [watched(1)])
    const before = set.revision

    set.applyBlock(block([{txid: txidAt(3), outputs: [{address: addressAt(9), satoshis: 10}]}]), 12)

    expect(set.revision).toBe(before)
  })
})

describe('WatchSet.setUtxos', () => {
  // After a rewind the orphaned outpoints must leave the match set, so it is
  // rebuilt from the addresses rather than appended to.
  it('drops outpoints that are not in the new snapshot', () => {
    const set = new WatchSet('testnet', GAP_LIMIT, [watched(1), watched(2)])
    set.setUtxos([utxo(7, addressAt(1)), utxo(8, addressAt(2))])
    expect(set.items).toHaveLength(4)

    set.setUtxos([utxo(7, addressAt(1))])

    expect(set.items).toHaveLength(3)
    expect(set.utxoCount).toBe(1)
  })
})
