import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import type {Knex} from 'knex'
import {PlatformTransactionDAO} from '../../src/main/src/database/PlatformTransactionDAO'
import {PlatformTransaction} from '../../src/main/src/types/PlatformTransaction'
import {mergePlatformTransactions} from '../../src/main/src/utils/platformExplorerTransactions'
import {getKnex, migrateKnex} from '../../src/main/src/utils'
import {LOCAL_SOURCE_PREFIX} from '../../src/main/src/constants/database'

const WALLET = 'w1'
const ADDRESS = 'tdash1kq79z66rh34l4u2axlz3jv34zwshggnenul6cvwn'
const IDENTITY = 'GxJf9f1sTBt4fJwZhBXQpPGoRuUuPYGCFb9Q7zcZ1nAB'
const HASH = 'A1B2C3'

let knex: Knex
let dao: PlatformTransactionDAO

beforeEach(async () => {
  knex = getKnex()
  await migrateKnex(knex)
  await knex('wallet').insert({wallet_id: WALLET, network: 'testnet', encrypted_mnemonic: 'm'})
  dao = new PlatformTransactionDAO(knex)
})

afterEach(async () => {
  await knex.destroy()
})

// A stored row carries the net, and what moved is read back off it, so the two
// cannot be set apart.
const transaction = (overrides: Partial<PlatformTransaction> = {}): PlatformTransaction => {
  const row = {
    walletId: WALLET,
    hash: HASH,
    type: 'IDENTITY_TOP_UP',
    date: new Date('2026-01-15T16:15:33.127Z'),
    blockHeight: 587710,
    status: 'SUCCESS' as const,
    error: null,
    gasCredits: 13_407_020n,
    netCredits: -100_000_000n,
    sender: [{source: ADDRESS, amount: 100_000_000n}],
    recipient: [],
    ...overrides,
  }
  const moved = row.netCredits < 0n ? -row.netCredits : row.netCredits
  const end = (ends: typeof row.sender): typeof row.sender =>
    ends.map(entry => ({...entry, amount: moved}))
  return {...row, amountCredits: moved, sender: end(row.sender), recipient: end(row.recipient)}
}

describe('cached platform transactions', () => {
  it('round-trips credits and the millisecond timestamp', async () => {
    const stored = transaction({netCredits: 9_007_199_254_740_993n})
    await dao.upsertTransactions(ADDRESS, [stored])

    expect(await dao.getTransactions(WALLET)).toEqual([stored])
  })

  it('keeps the two sides of one transition apart and folds them on read', async () => {
    await dao.upsertTransactions(ADDRESS, [transaction({netCredits: -100_000_000n})])
    await dao.upsertTransactions(IDENTITY, [transaction({
      netCredits: 99_000_000n,
      blockHeight: null,
      status: null,
      sender: [],
      recipient: [{source: IDENTITY, amount: 99_000_000n}],
    })])

    const rows = await dao.getTransactions(WALLET)
    expect(rows).toHaveLength(2)

    const [merged] = mergePlatformTransactions(rows)
    expect(merged.netCredits).toBe(-1_000_000n)
    expect(merged.blockHeight).toBe(587710)
    expect(merged.sender).toEqual([{source: ADDRESS, amount: 100_000_000n}])
    expect(merged.recipient).toEqual([{source: IDENTITY, amount: 99_000_000n}])
    expect(merged.amountCredits).toBe(100_000_000n)
  })

  it('counts a re-read page once', async () => {
    await dao.upsertTransactions(ADDRESS, [transaction()])
    await dao.upsertTransactions(ADDRESS, [transaction()])

    expect(mergePlatformTransactions(await dao.getTransactions(WALLET))[0].netCredits).toBe(-100_000_000n)
  })

  it('fills in what an early read was too soon to carry', async () => {
    await dao.upsertTransactions(ADDRESS, [transaction({blockHeight: null, status: null})])
    await dao.upsertTransactions(ADDRESS, [transaction()])

    const [row] = await dao.getTransactions(WALLET)
    expect(row.blockHeight).toBe(587710)
    expect(row.status).toBe('SUCCESS')
  })

  it('reports known hashes per source, so one walk cannot stop the other', async () => {
    await dao.upsertTransactions(ADDRESS, [transaction()])

    expect(await dao.getKnownHashes(WALLET, ADDRESS)).toEqual(new Set([HASH]))
    expect(await dao.getKnownHashes(WALLET, IDENTITY)).toEqual(new Set())
  })

  it('drops the rows of a source the wallet no longer asks about', async () => {
    await dao.upsertTransactions('tdash1retiredaddressnothingwalksagain00000000000', [transaction()])
    await dao.upsertTransactions(IDENTITY, [transaction()])

    await dao.deleteRetiredSources(WALLET, [ADDRESS, IDENTITY])

    const rows = await dao.getTransactions(WALLET)
    expect(rows).toHaveLength(1)
    expect(mergePlatformTransactions(rows)[0].netCredits).toBe(-100_000_000n)
  })

  // The explorer answers 0 for a top-up or a registration funded by a chain
  // asset lock, whose amount it never resolved. What was locked is on disk
  // here, under the hash the transition settled into.
  it('prices a transition the explorer left at zero from the lock this wallet funded', async () => {
    await dao.upsertTransactions(IDENTITY, [transaction({netCredits: 0n, recipient: [{source: IDENTITY, amount: 0n}]})])
    await knex('asset_lock_fundings').insert({
      wallet_id: WALLET,
      txid: 'f1',
      output_index: 0,
      credit_derivation_path: "m/9'/1'/5'/0'/0",
      amount_duffs: '100000000',
      to_platform_address: IDENTITY,
      kind: 'identityTopUp',
      status: 'done',
      // dpp reports it in lower case, the explorer answers in upper.
      st_hash: HASH.toLowerCase(),
    })

    const [row] = await dao.getTransactions(WALLET)
    expect(row.amountCredits).toBe(100_000_000_000n)
  })

  it('leaves a transition the explorer priced alone', async () => {
    await dao.upsertTransactions(IDENTITY, [transaction({netCredits: 99_000_000n})])
    await knex('asset_lock_fundings').insert({
      wallet_id: WALLET, txid: 'f2', output_index: 0, credit_derivation_path: "m/9'/1'/5'/0'/0",
      amount_duffs: '100000000', to_platform_address: IDENTITY, kind: 'identityTopUp', status: 'done',
      st_hash: HASH.toLowerCase(),
    })

    const [row] = await dao.getTransactions(WALLET)
    expect(row.amountCredits).toBe(99_000_000n)
  })

  it('returns newest first', async () => {
    await dao.upsertTransactions(ADDRESS, [
      transaction({hash: 'OLDER', date: new Date('2025-01-12T08:07:25.094Z')}),
      transaction({hash: 'NEWER', date: new Date('2026-09-17T00:01:51.733Z')}),
    ])

    expect((await dao.getTransactions(WALLET)).map(row => row.hash)).toEqual(['NEWER', 'OLDER'])
  })

  // dpp hashes the transition a send just broadcast in lower case, and the walk
  // that reaches it reports the same transition in upper.
  it('stores one row for a transition reported in either case', async () => {
    await dao.upsertTransactions(`${LOCAL_SOURCE_PREFIX}${ADDRESS}`, [transaction({hash: HASH.toLowerCase()})])
    await dao.upsertTransactions(ADDRESS, [transaction({hash: HASH})])

    const rows = await dao.getTransactions(WALLET)
    expect(rows).toHaveLength(1)
    expect(rows[0].hash).toBe(HASH)
  })
})
