import {describe, it, expect, beforeEach, vi} from 'vitest'

const fetches = vi.hoisted(() => ({calls: [] as Array<{url: string; init?: RequestInit}>}))

vi.mock('electron', () => ({
  net: {
    fetch: (url: string, init?: RequestInit) => {
      fetches.calls.push({url, init})
      return Promise.resolve(responder(url, init))
    },
  },
}))

import {DashscanWalletProvider} from '../../src/main/src/providers/DashscanWalletProvider'
import {AddressDAO} from '../../src/main/src/database/AddressDAO'
import {WalletDAO} from '../../src/main/src/database/WalletDAO'
import {DashscanTransaction} from '../../src/main/src/types/Dashscan'

const OURS = 'yRd4FhXfVGHXpsuZXPNkMrfD9GVj46pnjt'
const XPUB = 'tpubDC5FSnBiZDMmhiuCmWAYsLwgLYrrT9rAqvTySfuCCrgsWz8wxMXUS9Tb9iVMvcRbvFcAHGkMD5Kx8koh4GquNGNTfohfk7pgjhaPCdXpoba'

let responder: (url: string, init?: RequestInit) => Response

const json = (body: unknown): Response =>
  ({ok: true, status: 200, json: async () => body} as Response)

const tx = (hash: string, blockHeight: number | null): DashscanTransaction => ({
  hash,
  type: 'CLASSIC',
  blockHeight,
  blockHash: blockHeight != null ? 'bh' : null,
  timestamp: blockHeight != null ? '2020-04-09T06:00:12.000Z' : null,
  amount: '1000',
  version: 2,
  size: 226,
  vIn: [],
  vOut: [{
    value: 1000, number: 0, scriptPubKeyASM: null, scriptPubKeyHex: null,
    scriptPubKeyType: 'pubkeyhash', address: OURS, addresses: [OURS],
    spentTxId: null, spentIndex: null, spentHeight: null,
  }],
  confirmations: blockHeight != null ? 10 : null,
  instantLock: null,
  chainLocked: false,
  coinjoin: false,
  multisig: false,
})

const daos = (): {addressDAO: AddressDAO; walletDAO: WalletDAO} => ({
  addressDAO: {
    getAddressesByWalletId: async () => ({
      receiving: [{address: OURS}], change: [],
    }),
  } as unknown as AddressDAO,
  walletDAO: {
    getWalletById: async () => ({coreXpub: XPUB}),
  } as unknown as WalletDAO,
})

const bodyOf = (call: {init?: RequestInit}): Record<string, unknown> =>
  JSON.parse(String(call.init?.body))

describe('xpub transaction walk', () => {
  beforeEach(() => {
    fetches.calls.length = 0
  })

  it('posts the xpub rather than putting it in the path', async () => {
    responder = () => json({resultSet: [tx('aa', 100)], pagination: {limit: 100, nextCursor: null}})
    const {addressDAO, walletDAO} = daos()

    await new DashscanWalletProvider('testnet', 'w1', addressDAO, walletDAO).getWalletTransactions()

    const [call] = fetches.calls
    expect(call.url).toContain('/xpub/transactions')
    expect(call.url).not.toContain(XPUB)
    expect(call.init?.method).toBe('POST')
    expect(bodyOf(call).xpub).toBe(XPUB)
  })

  it('starts without a cursor so pending transactions are included', async () => {
    responder = () => json({resultSet: [tx('aa', null)], pagination: {limit: 100, nextCursor: null}})
    const {addressDAO, walletDAO} = daos()

    const result = await new DashscanWalletProvider('testnet', 'w1', addressDAO, walletDAO).getWalletTransactions()

    expect(bodyOf(fetches.calls[0]!).cursor).toBeUndefined()
    expect(result).toHaveLength(1)
    expect(result[0]!.blockHeight).toBe(0)
  })

  it('follows nextCursor until it comes back null', async () => {
    const pages = [
      {resultSet: [tx('aa', 300)], pagination: {limit: 100, nextCursor: 'aa'}},
      {resultSet: [tx('bb', 200)], pagination: {limit: 100, nextCursor: 'bb'}},
      {resultSet: [tx('cc', 100)], pagination: {limit: 100, nextCursor: null}},
    ]
    let page = 0
    responder = () => json(pages[page++])
    const {addressDAO, walletDAO} = daos()

    const result = await new DashscanWalletProvider('testnet', 'w1', addressDAO, walletDAO).getWalletTransactions()

    expect(fetches.calls).toHaveLength(3)
    expect(bodyOf(fetches.calls[1]!).cursor).toBe('aa')
    expect(bodyOf(fetches.calls[2]!).cursor).toBe('bb')
    expect(result.map(t => t.txid).sort()).toEqual(['aa', 'bb', 'cc'])
  })

  // A server that keeps handing back the same marker would otherwise spin here.
  it('stops when the cursor stops advancing', async () => {
    responder = () => json({resultSet: [tx('aa', 100)], pagination: {limit: 100, nextCursor: 'stuck'}})
    const {addressDAO, walletDAO} = daos()

    await new DashscanWalletProvider('testnet', 'w1', addressDAO, walletDAO).getWalletTransactions()

    expect(fetches.calls).toHaveLength(2)
  })

  it('uses the same path on mainnet', async () => {
    responder = () => json({resultSet: [tx('aa', 100)], pagination: {limit: 100, nextCursor: null}})
    const {addressDAO, walletDAO} = daos()

    await new DashscanWalletProvider('mainnet', 'w1', addressDAO, walletDAO).getWalletTransactions()

    expect(fetches.calls[0]!.url).toBe('https://dashscan.pshenmic.dev/xpub/transactions')
  })

  it('fails loudly when the wallet has no account xpub', async () => {
    responder = () => json({resultSet: [], pagination: {limit: 100, nextCursor: null}})
    const {addressDAO} = daos()
    const walletDAO = {getWalletById: async () => ({coreXpub: null})} as unknown as WalletDAO

    await expect(
      new DashscanWalletProvider('testnet', 'w1', addressDAO, walletDAO).getWalletTransactions(),
    ).rejects.toThrow('no account xpub')
    expect(fetches.calls).toHaveLength(0)
  })
})

const xpubAddress = (branch: number, index: number, used: boolean): Record<string, unknown> => ({
  address: `server-supplied-${branch}-${index}`,
  branch,
  index,
  used,
})

describe('xpub address scan', () => {
  beforeEach(() => {
    fetches.calls.length = 0
  })

  it('maps branch to isChange and keeps only position and usage', async () => {
    responder = () => json({
      resultSet: [xpubAddress(0, 0, true), xpubAddress(0, 1, false), xpubAddress(1, 0, true)],
      pagination: {page: 1, limit: 100, total: 3},
    })
    const {addressDAO, walletDAO} = daos()

    const scan = await new DashscanWalletProvider('testnet', 'w1', addressDAO, walletDAO).scanAddressUsage(50)

    expect(scan).toEqual([
      {isChange: false, index: 0, isUsed: true},
      {isChange: false, index: 1, isUsed: false},
      {isChange: true, index: 0, isUsed: true},
    ])
    // The address strings the server derived must not survive into our model.
    expect(JSON.stringify(scan)).not.toContain('server-supplied')
  })

  it('passes our own lookahead as the gap limit', async () => {
    responder = () => json({resultSet: [xpubAddress(0, 0, false)], pagination: {page: 1, limit: 100, total: 1}})
    const {addressDAO, walletDAO} = daos()

    await new DashscanWalletProvider('testnet', 'w1', addressDAO, walletDAO).scanAddressUsage(50)

    expect(bodyOf(fetches.calls[0]!).gap_limit).toBe(50)
  })

  it('walks every page of the scan', async () => {
    const full = Array.from({length: 100}, (_, i) => xpubAddress(0, i, false))
    responder = (_url, init) => json(JSON.parse(String(init?.body)).page === 1
      ? {resultSet: full, pagination: {page: 1, limit: 100, total: 101}}
      : {resultSet: [xpubAddress(1, 0, false)], pagination: {page: 2, limit: 100, total: 101}})
    const {addressDAO, walletDAO} = daos()

    const scan = await new DashscanWalletProvider('testnet', 'w1', addressDAO, walletDAO).scanAddressUsage(50)

    expect(fetches.calls).toHaveLength(2)
    expect(scan).toHaveLength(101)
  })

  it('scans on mainnet too', async () => {
    responder = () => json({resultSet: [xpubAddress(0, 0, true)], pagination: {page: 1, limit: 100, total: 1}})
    const {addressDAO, walletDAO} = daos()

    const scan = await new DashscanWalletProvider('mainnet', 'w1', addressDAO, walletDAO).scanAddressUsage(50)

    expect(scan).toEqual([{isChange: false, index: 0, isUsed: true}])
    expect(fetches.calls[0]!.url).toBe('https://dashscan.pshenmic.dev/xpub/addresses')
  })
})

const utxo = (address: string, amount: string, txid = 'aa'): Record<string, unknown> => ({
  prevTxHash: txid,
  vOutIndex: 0,
  address,
  amount,
  scriptPubKeyHex: '76a9143a2d4145a4f098523b3e8127f1da87cfc55b8e7988ac',
  blockHeight: 100,
  confirmations: 5,
})

describe('xpub utxo set', () => {
  beforeEach(() => {
    fetches.calls.length = 0
  })

  it('posts the xpub and maps the wire shape', async () => {
    responder = () => json({resultSet: [utxo(OURS, '250000')], pagination: {page: 1, limit: 100, total: 1}})
    const {addressDAO, walletDAO} = daos()

    const utxos = await new DashscanWalletProvider('testnet', 'w1', addressDAO, walletDAO).getWalletUtxos()

    expect(fetches.calls[0]!.url).toContain('/xpub/utxo')
    expect(bodyOf(fetches.calls[0]!).xpub).toBe(XPUB)
    expect(utxos).toHaveLength(1)
    expect(utxos[0]!.satoshis).toBe(250000n)
    expect(utxos[0]!.address).toBe(OURS)
  })

  it('walks every page', async () => {
    const full = Array.from({length: 100}, (_, i) => utxo(OURS, '1000', `tx${i}`))
    responder = (_url, init) => json(JSON.parse(String(init?.body)).page === 1
      ? {resultSet: full, pagination: {page: 1, limit: 100, total: 101}}
      : {resultSet: [utxo(OURS, '1000', 'last')], pagination: {page: 2, limit: 100, total: 101}})
    const {addressDAO, walletDAO} = daos()

    const utxos = await new DashscanWalletProvider('testnet', 'w1', addressDAO, walletDAO).getWalletUtxos()

    expect(fetches.calls).toHaveLength(2)
    expect(utxos).toHaveLength(101)
  })

  it('drops outputs missing the fields needed to spend them', async () => {
    responder = () => json({
      resultSet: [utxo(OURS, '1000'), {...utxo(OURS, '2000', 'bb'), scriptPubKeyHex: null}],
      pagination: {page: 1, limit: 100, total: 2},
    })
    const {addressDAO, walletDAO} = daos()

    const utxos = await new DashscanWalletProvider('testnet', 'w1', addressDAO, walletDAO).getWalletUtxos()

    expect(utxos).toHaveLength(1)
    expect(utxos[0]!.satoshis).toBe(1000n)
  })
})

describe('wallet balance', () => {
  beforeEach(() => {
    fetches.calls.length = 0
  })

  it('reads the summary balance in one call', async () => {
    responder = () => json({balance: '4820046182581', received: '9107800090158', sent: '9218003263407'})
    const {addressDAO, walletDAO} = daos()

    const balance = await new DashscanWalletProvider('testnet', 'w1', addressDAO, walletDAO).getWalletBalance()

    expect(balance).toBe(4820046182581n)
    expect(fetches.calls).toHaveLength(1)
    expect(fetches.calls[0]!.url).toBe('https://testnet.dashscan.pshenmic.dev/xpub')
    expect(bodyOf(fetches.calls[0]!).gap_limit).toBe(50)
  })

  // received and sent both count internal change, so neither reconciles with
  // balance.
  it('ignores the gross flow figures beside it', async () => {
    responder = () => json({balance: '0', received: '3448058400', sent: '3448058400'})
    const {addressDAO, walletDAO} = daos()

    const balance = await new DashscanWalletProvider('testnet', 'w1', addressDAO, walletDAO).getWalletBalance()

    expect(balance).toBe(0n)
  })
})

describe('per-address info folded from wallet-wide results', () => {
  const OTHER = 'yfd64jEpzzTLrHnR1wq3iiYXh68AiU8mcw'

  beforeEach(() => {
    fetches.calls.length = 0
  })

  it('sums balance per address and counts each transaction once', async () => {
    const paying = tx('aa', 100)
    paying.vIn = [{prevTxHash: 'zz', vOutIndex: 0, address: OURS, amount: '5000', sequence: null, scriptSigASM: null}]
    responder = (url) => url.includes('/xpub/utxo')
      ? json({resultSet: [utxo(OURS, '1000'), utxo(OURS, '2000', 'bb')], pagination: {page: 1, limit: 100, total: 2}})
      : json({resultSet: [paying], pagination: {limit: 100, nextCursor: null}})
    const {addressDAO, walletDAO} = daos()

    const infos = await new DashscanWalletProvider('testnet', 'w1', addressDAO, walletDAO)
      .getAddressInfos([OURS, OTHER])

    // OURS is on both sides of the one transaction — still one.
    expect(infos).toEqual([
      {address: OURS, balance: 3000n, txCount: 1},
      {address: OTHER, balance: 0n, txCount: 0},
    ])
  })

  it('asks for nothing when given no addresses', async () => {
    responder = () => json({resultSet: [], pagination: {page: 1, limit: 100, total: -1}})
    const {addressDAO, walletDAO} = daos()

    const infos = await new DashscanWalletProvider('testnet', 'w1', addressDAO, walletDAO).getAddressInfos([])

    expect(infos).toEqual([])
    expect(fetches.calls).toHaveLength(0)
  })
})
