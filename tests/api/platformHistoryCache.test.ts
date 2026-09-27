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

import {PlatformAddressWASM, SerializedActionWASM, UnshieldTransitionWASM} from 'pshenmic-dpp'
import {IdentityDAO} from '../../src/main/src/database/IdentityDAO'
import {PlatformAddressDAO} from '../../src/main/src/database/PlatformAddressDAO'
import {PlatformTransactionDAO} from '../../src/main/src/database/PlatformTransactionDAO'
import {ShieldedNoteDAO} from '../../src/main/src/database/ShieldedNoteDAO'
import {ShieldedPoolDAO} from '../../src/main/src/database/ShieldedPoolDAO'
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
  amount: '99000000', sender: null, recipient: IDENTITY,
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
let noteDAO: ShieldedNoteDAO
let poolDAO: ShieldedPoolDAO

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

  noteDAO = new ShieldedNoteDAO(knex)
  poolDAO = new ShieldedPoolDAO(knex)
  service = new PlatformHistoryService(
    new WalletDAO(knex), identityDAO, addressDAO, transactionDAO, noteDAO, poolDAO)
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
    // -100000000 from the address, +99000000 into the identity: the gap is the
    // fee, and the row still names both ends and what they moved.
    expect(transactions[0].netCredits).toBe(-1_000_000n)
    expect(transactions[0].amountCredits).toBe(100_000_000n)
    expect(transactions[0].sender).toEqual([{source: ADDRESS, amount: 100_000_000n}])
    expect(transactions[0].recipient).toEqual([{source: IDENTITY, amount: 99_000_000n}])
    expect(await transactionDAO.getTransactions(WALLET)).toHaveLength(2)
  })

  it('names our address in the encoding platform_addresses stores', async () => {
    responder = (path) => page(path.startsWith('/identity/') ? [] : [transition])
    await service.refresh(WALLET)

    const [row] = await transactionDAO.getTransactions(WALLET)
    const [stored] = await addressDAO.getAddresses(WALLET)
    expect(row.sender).toEqual([{source: stored.address, amount: 100_000_000n}])
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

  // An unshield tells the address it paid only what arrived there. What left
  // the pool is in the notes it spent, which only this wallet can read.
  it('counts our own notes into a shielded transition', async () => {
    const SHIELDED = 'tdash1zrv282am68uyhwerv7cm0ja86445lqg5zymu7rw24yyj2d443f3a7lnxtanyr5wwuv6350g3h4av5'
    const fill = (value: number, length = 32): Uint8Array => new Uint8Array(length).fill(value)
    const action = (nullifier: number, cmx: number): SerializedActionWASM =>
      new SerializedActionWASM(fill(nullifier), fill(2), fill(cmx), fill(4, 580), fill(5), fill(6, 64))

    // Spends note 4525 and pays the change back to the same address as 4527.
    const unshield = new UnshieldTransitionWASM(
      PlatformAddressWASM.fromBytes(new Uint8Array(21)),
      [action(11, 99), action(98, 12)],
      100_168_934_000n,
      fill(7), fill(8, 192), fill(9, 64),
    )

    await poolDAO.saveEncryptedNotes('testnet', [
      {index: 4525, nullifier: fill(11), cmx: fill(50), encryptedNote: fill(4, 580), cvNet: fill(5)},
      {index: 4527, nullifier: fill(12), cmx: fill(12), encryptedNote: fill(4, 580), cvNet: fill(5)},
    ])
    await noteDAO.upsertNotes(WALLET, [
      {index: 4525, amount: 2_957_457_752_000n, address: SHIELDED, spent: true, nullifier: fill(11)},
      {index: 4527, amount: 2_857_288_818_000n, address: SHIELDED, spent: false, nullifier: fill(12)},
    ])

    const row = {...transition, hash: 'UNSHIELDHASH', type: 'UNSHIELD',
      incoming: true, amount: '100000000000'}
    responder = (path) => {
      if (path.startsWith('/transaction/')) {
        return {ok: true, status: 200, json: async () => ({
          hash: 'UNSHIELDHASH', type: 'UNSHIELD', data: unshield.toStateTransition().base64(),
        })} as Response
      }
      return page(path.startsWith('/identity/') ? [] : [row])
    }

    // The walk alone: the rows it stores are checked against the notes a sync
    // decrypted earlier, without waiting for the next one.
    await service.refresh(WALLET)

    const [merged] = mergePlatformTransactions(await transactionDAO.getTransactions(WALLET))
    expect(merged.amountCredits).toBe(100_168_934_000n)
    expect(merged.sender).toEqual([{source: SHIELDED, amount: 100_168_934_000n}])
    expect(merged.recipient).toEqual([{source: ADDRESS, amount: 100_000_000_000n}])
    // The address gained 100000000000 of the 100168934000 that left the pool.
    expect(merged.netCredits).toBe(-168_934_000n)
  })

  // A shielded transfer names no address for a walk to list it under, so the row
  // the send wrote keeps the outcome it had at the time — none — unless the
  // transition itself is asked.
  it('fills the outcome of a transition no walk reports', async () => {
    const SHIELDED = 'tdash1zrv282am68uyhwerv7cm0ja86445lqg5zymu7rw24yyj2d443f3a7lnxtanyr5wwuv6350g3h4av5'
    const fill = (value: number, length = 32): Uint8Array => new Uint8Array(length).fill(value)
    const sent = new UnshieldTransitionWASM(
      PlatformAddressWASM.fromBytes(new Uint8Array(21)),
      [new SerializedActionWASM(fill(21), fill(2), fill(22), fill(4, 580), fill(5), fill(6, 64))],
      100_162_851_200n,
      fill(7), fill(8, 192), fill(9, 64),
    )

    await noteDAO.upsertNotes(WALLET, [
      {index: 5001, amount: 100_162_851_200n, address: SHIELDED, spent: true, nullifier: fill(21)},
    ])
    // dpp hashes it in lower case; the explorer answers in upper.
    await service.recordShieldedSend(WALLET, {
      hash: 'edb3279315bc3c6f2165ac79f8fbd8dfbac29a8b0bec8387e5a3a6f57abd4411',
      type: 'SHIELDED_TRANSFER',
      sides: [{address: SHIELDED, credits: -100_162_851_200n}],
      paid: null,
    })

    responder = (path) => path.startsWith('/transaction/')
      ? ({ok: true, status: 200, json: async () => ({
        hash: 'EDB3279315BC3C6F2165AC79F8FBD8DFBAC29A8B0BEC8387E5A3A6F57ABD4411',
        type: 'SHIELDED_TRANSFER', timestamp: '2026-09-24T16:46:10.426Z', blockHeight: 599153,
        gasUsed: 162851200, status: 'SUCCESS', error: null, data: sent.toStateTransition().base64(),
      })} as Response)
      : page([])

    await service.refresh(WALLET)

    const rows = mergePlatformTransactions(await transactionDAO.getTransactions(WALLET))
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('SUCCESS')
    expect(rows[0].blockHeight).toBe(599153)
    expect(rows[0].gasCredits).toBe(162_851_200n)
    expect(rows[0].sender).toEqual([{source: SHIELDED, amount: 100_162_851_200n}])
  })

  // The explorer lists a transition a block or two after it is sent, and the
  // note behind it waits for the next sync. Neither is a reason for the list to
  // be missing what this wallet just did.
  it('carries a transition this wallet sent before anything else reports it', async () => {
    const SHIELDED = 'tdash1zrv282am68uyhwerv7cm0ja86445lqg5zymu7rw24yyj2d443f3a7lnxtanyr5wwuv6350g3h4av5'
    responder = () => page([])

    await service.recordShieldedSend(WALLET, {
      hash: 'SENTHASH',
      type: 'SHIELD',
      sides: [
        {address: ADDRESS, credits: -443_567_314_000n},
        {address: SHIELDED, credits: 443_567_314_000n},
      ],
      paid: null,
    })

    const [row] = mergePlatformTransactions(await transactionDAO.getTransactions(WALLET))
    expect(row.hash).toBe('SENTHASH')
    expect(row.amountCredits).toBe(443_567_314_000n)
    expect(row.sender).toEqual([{source: ADDRESS, amount: 443_567_314_000n}])
    expect(row.recipient).toEqual([{source: SHIELDED, amount: 443_567_314_000n}])
    // Both ends are ours, so nothing left the wallet but the fee it has yet to
    // learn.
    expect(row.netCredits).toBe(0n)
    expect(row.status).toBeNull()

    // And the walk that finds it later folds into it rather than doubling it.
    responder = (path) => page(path.startsWith('/identity/')
      ? []
      : [{...transition, hash: 'SENTHASH', type: 'SHIELD', amount: '-443730165200'}])
    await service.refresh(WALLET)

    const [folded] = mergePlatformTransactions(await transactionDAO.getTransactions(WALLET))
    // The walk replaced what the send guessed about the address it spent.
    expect(folded.netCredits).toBe(-162_851_200n)
    expect(folded.sender).toEqual([{source: ADDRESS, amount: 443_730_165_200n}])
    expect(folded.recipient).toEqual([{source: SHIELDED, amount: 443_567_314_000n}])
  })

  // Both ends inside the pool and both ours: the fee is the only cost, and the
  // row still has to say which address paid which.
  it('nets a transfer between two of our own shielded addresses to nothing', async () => {
    const FROM = 'tdash1zrv282am68uyhwerv7cm0ja86445lqg5zymu7rw24yyj2d443f3a7lnxtanyr5wwuv6350g3h4av5'
    const TO = 'tdash1zq2j8jgzspy42499wzc4xd4ez6tj6nvuhuw20ucdugrys2xjfgqaplc32zja5kx62w6qu8sylj2vk'
    responder = () => page([])

    await service.recordShieldedSend(WALLET, {
      hash: 'TRANSFERHASH',
      type: 'SHIELDED_TRANSFER',
      sides: [{address: FROM, credits: -50_000n}, {address: TO, credits: 50_000n}],
      paid: null,
    })

    const [row] = mergePlatformTransactions(await transactionDAO.getTransactions(WALLET))
    expect(row.netCredits).toBe(0n)
    expect(row.amountCredits).toBe(50_000n)
    expect(row.sender).toEqual([{source: FROM, amount: 50_000n}])
    expect(row.recipient).toEqual([{source: TO, amount: 50_000n}])
  })

  it('names the end it paid when that end is nobody of ours', async () => {
    const FROM = 'tdash1zrv282am68uyhwerv7cm0ja86445lqg5zymu7rw24yyj2d443f3a7lnxtanyr5wwuv6350g3h4av5'
    responder = () => page([])

    await service.recordShieldedSend(WALLET, {
      hash: 'PAIDHASH',
      type: 'SHIELDED_TRANSFER',
      sides: [{address: FROM, credits: -50_000n}],
      paid: {source: 'tdash1stranger', amount: 50_000n},
    })

    const [row] = mergePlatformTransactions(await transactionDAO.getTransactions(WALLET))
    expect(row.netCredits).toBe(-50_000n)
    expect(row.sender).toEqual([{source: FROM, amount: 50_000n}])
    expect(row.recipient).toEqual([{source: 'tdash1stranger', amount: 50_000n}])
  })

  it('asks nothing for a wallet that owns no platform address and no identity', async () => {
    await knex('wallet').insert({wallet_id: 'w2', network: 'testnet', encrypted_mnemonic: 'm2'})
    net.paths.length = 0

    await service.refresh('w2')

    expect(net.paths).toEqual([])
    expect(mergePlatformTransactions(await transactionDAO.getTransactions('w2'))).toEqual([])
  })
})
