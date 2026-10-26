import {describe, expect, it} from 'vitest'
import {
  coinControlSortOptions,
  coinControlSourceAddresses,
  dustFilterKeepKeys,
  hideUnselectedDust,
  sortCoinControlInputs,
  steppedFeePayer,
} from '../../src/renderer/src/utils/coinControlView'
import {CoinControlSort} from '../../src/renderer/src/enums/CoinControl'
import {SourceKind} from '../../src/renderer/src/enums/SourceKind'
import type {CoinControlFunds} from '../../src/renderer/src/types/CoinControl'
import type {WalletAddressDto} from '../../src/renderer/src/api/types'

const isDust = (amount: number): boolean => amount < 10
const selected = new Set([3])

describe('hideUnselectedDust', () => {
  it('returns every item when the filter is off', () => {
    const items = [3, 5, 20]
    expect(hideUnselectedDust(items, false, isDust, item => selected.has(item))).toBe(items)
  })

  it('hides unselected dust and keeps selected dust visible', () => {
    expect(hideUnselectedDust([3, 5, 20], true, isDust, item => selected.has(item))).toEqual([3, 20])
  })
})

describe('dustFilterKeepKeys', () => {
  it('keeps the keys of every given selection and of every toggled row', () => {
    const keys = dustFilterKeepKeys([
      {kind: 'coreOutpoints', outpoints: ['a:0']},
      {kind: 'platformInputs', inputs: [{address: 'platform-1', credits: 1n}], feeAddress: 'platform-1'},
      {kind: 'shieldedNotes', noteIndexes: [4]},
      {kind: 'automatic'},
    ], ['b:1'])
    expect([...keys].sort()).toEqual(['4', 'a:0', 'b:1', 'platform-1'])
  })

  it('keeps a selected dust row visible after it is unchecked', () => {
    const opened = {kind: 'coreOutpoints' as const, outpoints: ['dust:0']}
    const unchecked = {kind: 'coreOutpoints' as const, outpoints: []}
    const keys = dustFilterKeepKeys([unchecked, opened], ['dust:0'])
    expect(hideUnselectedDust(['dust:0', 'other:0'], true, () => true, key => keys.has(key))).toEqual(['dust:0'])
  })
})

describe('steppedFeePayer', () => {
  const addresses = ['a', 'b', 'c']

  it.each([
    ['ArrowDown', 'a', 'b'],
    ['ArrowRight', 'c', 'a'],
    ['ArrowUp', 'a', 'c'],
    ['ArrowLeft', 'b', 'a'],
  ])('moves on %s from %s to %s and wraps at the ends', (key, current, expected) => {
    expect(steppedFeePayer(addresses, current, key)).toBe(expected)
  })

  it('ignores other keys and unknown inputs', () => {
    expect(steppedFeePayer(addresses, 'a', 'Enter')).toBeNull()
    expect(steppedFeePayer(addresses, 'z', 'ArrowDown')).toBeNull()
  })
})

describe('coinControlSourceAddresses', () => {
  const funds: CoinControlFunds = {
    coreAddresses: [],
    utxos: [
      {txid: 'a', vout: 0, address: 'core-1', satoshis: 1n, height: 1, timestamp: null, confirmations: 1},
      {txid: 'b', vout: 1, address: 'core-1', satoshis: 1n, height: 1, timestamp: null, confirmations: 1},
      {txid: 'c', vout: 0, address: 'core-2', satoshis: 1n, height: 1, timestamp: null, confirmations: 1},
    ],
    platformAddresses: [{platformAddress: 'platform-1', balanceCredits: 1n, nonce: 0}],
    shieldedNotes: [
      {index: 1, amount: 1n, spent: false, address: 'shielded-1'},
      {index: 2, amount: 1n, spent: false, address: 'shielded-1'},
    ],
  }

  it.each([
    [SourceKind.Core, ['core-1', 'core-2']],
    [SourceKind.PlatformAddress, ['platform-1']],
    [SourceKind.Shielded, ['shielded-1']],
    [SourceKind.Identity, []],
    [null, []],
  ])('lists only the unique addresses of the %s source', (sourceKind, expected) => {
    expect(coinControlSourceAddresses(sourceKind, funds)).toEqual(expected)
  })

  it('falls back to the wallet addresses when Core has no UTXOs', () => {
    const coreAddress = (address: string): WalletAddressDto => ({
      walletId: 'wallet', accountId: 0, address, derivationPath: '', index: 0, isChange: 0,
      isUsed: false, balance: 0n, txCount: 0, label: null, usdBalance: null,
    })
    const empty = {...funds, utxos: [], coreAddresses: [coreAddress('wallet-1'), coreAddress('wallet-1'), coreAddress('wallet-2')]}
    expect(coinControlSourceAddresses(SourceKind.Core, empty)).toEqual(['wallet-1', 'wallet-2'])
  })

  it('returns no addresses for a source without funds', () => {
    expect(coinControlSourceAddresses(SourceKind.Shielded, {...funds, shieldedNotes: []})).toEqual([])
    expect(coinControlSourceAddresses(SourceKind.PlatformAddress, {...funds, platformAddresses: []})).toEqual([])
  })
})

describe('sortCoinControlInputs', () => {
  const coins = [
    {id: 'a', amount: 5n, confirmations: 10},
    {id: 'b', amount: 50n, confirmations: 0},
    {id: 'c', amount: 1n, confirmations: 3},
  ]
  const ids = (sort: CoinControlSort, recency?: (coin: typeof coins[number]) => number): string[] =>
    sortCoinControlInputs(coins, sort, coin => coin.amount, recency).map(coin => coin.id)
  const byConfirmations = (coin: typeof coins[number]): number => -coin.confirmations

  it('orders by amount in both directions', () => {
    expect(ids(CoinControlSort.LargestFirst)).toEqual(['b', 'a', 'c'])
    expect(ids(CoinControlSort.SmallestFirst)).toEqual(['c', 'a', 'b'])
  })

  it('orders by recency in both directions', () => {
    expect(ids(CoinControlSort.Newest, byConfirmations)).toEqual(['b', 'c', 'a'])
    expect(ids(CoinControlSort.Oldest, byConfirmations)).toEqual(['a', 'c', 'b'])
  })

  it('keeps the given order for a date sort when the items cannot be dated', () => {
    expect(ids(CoinControlSort.Newest)).toEqual(['a', 'b', 'c'])
  })

  it('does not mutate the input', () => {
    ids(CoinControlSort.SmallestFirst)
    expect(coins.map(coin => coin.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('coinControlSortOptions', () => {
  it('offers only amount sorts for Platform addresses, which carry no date', () => {
    expect(coinControlSortOptions(SourceKind.PlatformAddress).map(option => option.value))
      .toEqual([CoinControlSort.LargestFirst, CoinControlSort.SmallestFirst])
  })

  it('offers amount and date sorts for Core and shielded inputs', () => {
    for (const kind of [SourceKind.Core, SourceKind.Shielded]) {
      expect(coinControlSortOptions(kind).map(option => option.value)).toEqual([
        CoinControlSort.LargestFirst,
        CoinControlSort.SmallestFirst,
        CoinControlSort.Newest,
        CoinControlSort.Oldest,
      ])
    }
  })
})
