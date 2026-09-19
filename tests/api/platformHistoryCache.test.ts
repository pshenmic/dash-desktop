import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import type {Knex} from 'knex'

const net = vi.hoisted(() => ({paths: [] as string[]}))

vi.mock('electron', () => ({
  net: {
    fetch: (url: string) => {
      const path = new URL(url).pathname + new URL(url).search
      net.paths.push(path)
      return Promise.resolve(responder(path))
    },
  },
}))

import {IdentityDAO} from '../../src/main/src/database/IdentityDAO'
import {PlatformAddressDAO} from '../../src/main/src/database/PlatformAddressDAO'
import {PlatformTransactionDAO} from '../../src/main/src/database/PlatformTransactionDAO'
import {WalletDAO} from '../../src/main/src/database/WalletDAO'
import {PlatformHistoryService} from '../../src/main/src/services/platform/PlatformHistoryService'
import {
  PLATFORM_EXPLORER_PAGE_LIMIT,
  PLATFORM_HISTORY_SEND_REFRESH_DELAYS_MS,
} from '../../src/main/src/constants/platformExplorer'
import {mergePlatformTransactions} from '../../src/main/src/utils/platformExplorerTransactions'
import {getKnex, migrateKnex} from '../../src/main/src/utils'

const WALLET = 'w1'
const ADDRESS = 'tdash1kq79z66rh34l4u2axlz3jv34zwshggnenul6cvwn'
const LATER_ADDRESS = 'tdash1zzz9z66rh34l4u2axlz3jv34zwshggnenul6cvwn'
const IDENTITY = 'DcoJJ3W9JauwLD51vzNuXJ9vnaZT7mprVm7wbgVYifNq'
const HASH = 'A1B2C3'

// The transition and the transfer name the same hash: one top-up, seen from the
// address that funded it and from the identity that received it.
const transition = {
  hash: HASH, index: 0, blockHash: 'bh', blockHeight: 587710, type: 'IDENTITY_TOP_UP',
  batchType: null, timestamp: '2026-01-15T16:15:33.127Z', gasUsed: 7927360, status: 'SUCCESS',
  error: null, incoming: false, amount: '-100000000', base58Address: 'yRpNvoc3hd66c3rNrPRGubVd9vGUoAVpZV',
  bech32mAddress: ADDRESS, addressesCount: 1,
}

const transfer = {
  amount: '99000000', sender: 'ExternalSenderIdentity', recipient: IDENTITY,
  timestamp: '2026-01-15T16:15:33.127Z', txHash: HASH, type: 'IDENTITY_TOP_UP',
  blockHash: 'bh', gasUsed: 7927360,
}

const page = (resultSet: unknown[]): Response =>
  ({ok: true, status: 200, json: async () => ({resultSet, pagination: {page: 1, limit: 100, total: -1}})} as Response)

// A full page, so a walk reading it sees more behind it rather than the end.
const fullPage = Array.from({length: PLATFORM_EXPLORER_PAGE_LIMIT}, (_, i) =>
  ({...transition, hash: `NEW${i}`, timestamp: `2026-03-${String((i % 28) + 1).padStart(2, '0')}T00:00:00.000Z`}))

const pageNumber = (path: string): number => Number(new URLSearchParams(path.split('?')[1]).get('page'))
const addressPaths = (): string[] => net.paths.filter(path => path.startsWith('/platformAddresses'))

let responder: (path: string) => Response
let knex: Knex
let service: PlatformHistoryService
let transactionDAO: PlatformTransactionDAO
let addressDAO: PlatformAddressDAO

const addAddress = (index: number, address: string): Promise<void> =>
  addressDAO.insertAddresses([
    {walletId: WALLET, index, address, derivationPath: `m/9'/1'/17'/0'/0'/${index}`, isUsed: true},
  ])

beforeEach(async () => {
  net.paths.length = 0
  responder = (path) => page(path.startsWith('/identity/') ? [transfer] : [transition])

  knex = getKnex()
  await migrateKnex(knex)
  await knex('wallet').insert({wallet_id: WALLET, network: 'testnet', encrypted_mnemonic: 'm'})

  addressDAO = new PlatformAddressDAO(knex)
  const identityDAO = new IdentityDAO(knex)
  transactionDAO = new PlatformTransactionDAO(knex)

  await addAddress(0, ADDRESS)
  await identityDAO.insertIdentity(
    {walletId: WALLET, identityIndex: 0, derivationPath: "m/9'/1'/5'/0'/0", identifier: IDENTITY},
    null,
  )

  service = new PlatformHistoryService(new WalletDAO(knex), identityDAO, addressDAO, transactionDAO)
})

afterEach(async () => {
  await knex.destroy()
})

describe('platform history', () => {
  it('stores what the explorer returned and folds the two sides into one row', async () => {
    await service.refresh(WALLET)
    const transactions = mergePlatformTransactions(await transactionDAO.getTransactions(WALLET))

    expect(transactions).toHaveLength(1)
    expect(transactions[0].hash).toBe(HASH)
    // -100000000 from the address, +99000000 into the identity: the gap is the fee.
    expect(transactions[0].netCredits).toBe(-1_000_000n)
    expect(transactions[0].counterparty).toBe('ExternalSenderIdentity')
    expect(await transactionDAO.getTransactions(WALLET)).toHaveLength(2)
  })

  it('names the subject in the encoding platform_addresses stores', async () => {
    responder = (path) => page(path.startsWith('/identity/') ? [] : [transition])
    await service.refresh(WALLET)

    const [row] = await transactionDAO.getTransactions(WALLET)
    const [stored] = await addressDAO.getAddresses(WALLET)
    expect(row.subject).toBe(stored.address)
  })

  it('asks each source for one page once its rows are known', async () => {
    await service.refresh(WALLET)
    net.paths.length = 0

    await service.refresh(WALLET)

    expect(addressPaths()).toHaveLength(1)
    expect(net.paths.filter(path => path.startsWith('/identity/'))).toHaveLength(1)
  })

  it('walks once when a send-triggered refresh overlaps the periodic one', async () => {
    await Promise.all([service.refresh(WALLET), service.refresh(WALLET)])

    expect(addressPaths()).toHaveLength(1)
    expect(net.paths.filter(path => path.startsWith('/identity/'))).toHaveLength(1)
  })

  // The broadcast a send triggers on is a block and an indexer behind the
  // explorer listing the transition.
  it('keeps looking after a send until the transition is indexed', async () => {
    const [first, second] = PLATFORM_HISTORY_SEND_REFRESH_DELAYS_MS
    vi.useFakeTimers()
    try {
      responder = () => page([])
      service.refreshAfterSend(WALLET)

      await vi.advanceTimersByTimeAsync(first)
      await vi.waitFor(() => expect(addressPaths()).toHaveLength(1))
      expect(await transactionDAO.getTransactions(WALLET)).toHaveLength(0)

      responder = (path) => page(path.startsWith('/identity/') ? [] : [transition])
      await vi.advanceTimersByTimeAsync(second)

      await vi.waitFor(async () =>
        expect((await transactionDAO.getTransactions(WALLET)).map(row => row.hash)).toEqual([HASH]))
    } finally {
      vi.useRealTimers()
    }
  })

  it('picks up a transition the previous walk was too early to see', async () => {
    await service.refresh(WALLET)
    responder = (path) => path.startsWith('/identity/')
      ? page([transfer])
      : page([{...transition, hash: 'NEWER', timestamp: '2026-02-01T00:00:00.000Z'}, transition])

    await service.refresh(WALLET)
    expect((mergePlatformTransactions(await transactionDAO.getTransactions(WALLET))).map(row => row.hash)).toEqual(['NEWER', HASH])
  })

  it('corrects a row it stored before the block carrying it was indexed', async () => {
    responder = (path) => path.startsWith('/identity/')
      ? page([])
      : page([{...transition, timestamp: null, status: null, blockHeight: null}])
    await service.refresh(WALLET)
    expect((mergePlatformTransactions(await transactionDAO.getTransactions(WALLET)))[0].date.getTime()).toBe(0)

    responder = (path) => page(path.startsWith('/identity/') ? [] : [transition])
    await service.refresh(WALLET)

    const [row] = mergePlatformTransactions(await transactionDAO.getTransactions(WALLET))
    expect(row.date.toISOString()).toBe('2026-01-15T16:15:33.127Z')
    expect(row.blockHeight).toBe(587710)
    expect(row.status).toBe('SUCCESS')
  })

  it('walks an address the window revealed after the first walk down to its oldest transition', async () => {
    responder = (path) => path.startsWith('/identity/') ? page([]) : page(pageNumber(path) === 1 ? fullPage : [])
    await service.refresh(WALLET)

    // The second address is older than everything cached, so it sits behind a
    // page the first walk already holds in full.
    await addAddress(1, LATER_ADDRESS)
    const older = {...transition, hash: 'OLDER', timestamp: '2020-01-01T00:00:00.000Z', bech32mAddress: LATER_ADDRESS}
    responder = (path) => path.startsWith('/identity/') ? page([]) : page(pageNumber(path) === 1 ? fullPage : [older])

    await service.refresh(WALLET)

    const hashes = (mergePlatformTransactions(await transactionDAO.getTransactions(WALLET))).map(row => row.hash)
    expect(hashes).toContain('OLDER')
    expect(hashes).toHaveLength(fullPage.length + 1)
  })

  it('keeps the pages a walk read before it died partway', async () => {
    responder = (path) => {
      if (path.startsWith('/identity/')) return page([])
      if (pageNumber(path) === 1) return fullPage.length > 0 ? page(fullPage) : page([])
      throw new Error('explorer died mid-walk')
    }

    await expect(service.refresh(WALLET)).rejects.toThrow(/Platform explorer request failed/)
    expect(mergePlatformTransactions(await transactionDAO.getTransactions(WALLET))).toHaveLength(fullPage.length)
  })

  it('serves stored rows when the explorer stops answering, and says the refresh failed', async () => {
    await service.refresh(WALLET)
    expect(service.lastRefreshFailed(WALLET)).toBe(false)

    responder = () => { throw new Error('offline') }
    await expect(service.refresh(WALLET)).rejects.toThrow(/Platform explorer request failed/)

    expect(service.lastRefreshFailed(WALLET)).toBe(true)
    expect((mergePlatformTransactions(await transactionDAO.getTransactions(WALLET))).map(row => row.hash)).toEqual([HASH])
  })

  it('asks nothing for a wallet that owns no platform address and no identity', async () => {
    await knex('wallet').insert({wallet_id: 'w2', network: 'testnet', encrypted_mnemonic: 'm2'})
    net.paths.length = 0

    await service.refresh('w2')

    expect(net.paths).toEqual([])
    expect(mergePlatformTransactions(await transactionDAO.getTransactions('w2'))).toEqual([])
  })
})
