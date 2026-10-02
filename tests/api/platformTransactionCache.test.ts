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

const transaction = (overrides: Partial<PlatformTransaction> = {}): PlatformTransaction => {
  const netCredits = overrides.netCredits ?? -100_000_000n
  const moved = netCredits < 0n ? -netCredits : netCredits

  return {
    walletId: WALLET,
    hash: HASH,
    type: 'IDENTITY_TOP_UP',
    date: new Date('2026-01-15T16:15:33.127Z'),
    blockHeight: 587710,
    status: 'SUCCESS',
    error: null,
    gasCredits: 13_407_020n,
    netCredits,
    amountCredits: moved,
    sender: [{source: ADDRESS, amount: moved}],
    recipient: [],
    ...overrides,
  }
}

describe('cached platform transactions', () => {
  it('round-trips credits and the millisecond timestamp', async () => {
    const stored = transaction({netCredits: 9_007_199_254_740_993n})
    await dao.upsertTransactions(ADDRESS, [stored])

    expect(await dao.getTransactions(WALLET)).toEqual([stored])
  })

  it('round-trips every participant with its own amount and position', async () => {
    const first = 9_007_199_254_740_993n
    const stored = transaction({
      netCredits: -1n,
      amountCredits: first,
      sender: [
        {source: 'sender-one', amount: first},
        {source: 'sender-two', amount: 0n},
      ],
      recipient: [
        {source: 'recipient-one', amount: 7n},
        {source: 'recipient-two', amount: 3n},
      ],
    })
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

  it('replaces stale participants when a source reports the transition again', async () => {
    const initial = transaction({
      hash: 'REPLACED',
      sender: [
        {source: 'stale-one', amount: 4n},
        {source: 'stale-two', amount: 3n},
      ],
      recipient: [{source: 'stale-recipient', amount: 7n}],
    })
    const replacement = transaction({
      hash: 'REPLACED',
      sender: [{source: 'current-sender', amount: 5n}],
      recipient: [
        {source: 'current-recipient-one', amount: 5n},
        {source: 'current-recipient-two', amount: 0n},
      ],
    })
    await dao.upsertTransactions(ADDRESS, [initial])
    await dao.upsertTransactions(ADDRESS, [replacement])

    expect(await dao.getTransactions(WALLET)).toEqual([{...replacement, amountCredits: 5n}])
    expect(await knex('platform_transaction_parts')
      .where({wallet_id: WALLET, hash: 'REPLACED', parent_source: ADDRESS})
      .orderBy('side')
      .orderBy('entry_index'))
      .toEqual([
        {wallet_id: WALLET, hash: 'REPLACED', parent_source: ADDRESS, side: 'recipient', entry_index: 0, part_source: 'current-recipient-one', amount_credits: '5'},
        {wallet_id: WALLET, hash: 'REPLACED', parent_source: ADDRESS, side: 'recipient', entry_index: 1, part_source: 'current-recipient-two', amount_credits: '0'},
        {wallet_id: WALLET, hash: 'REPLACED', parent_source: ADDRESS, side: 'sender', entry_index: 0, part_source: 'current-sender', amount_credits: '5'},
      ])
  })

  it('reports known hashes per source, so one walk cannot stop the other', async () => {
    await dao.upsertTransactions(ADDRESS, [transaction()])

    expect(await dao.getKnownHashes(WALLET, ADDRESS)).toEqual(new Set([HASH]))
    expect(await dao.getKnownHashes(WALLET, IDENTITY)).toEqual(new Set())
  })

  it('drops the rows and participants of a source the wallet no longer asks about', async () => {
    const retired = 'tdash1retiredaddressnothingwalksagain00000000000'
    await dao.upsertTransactions(retired, [transaction()])
    await dao.upsertTransactions(IDENTITY, [transaction()])

    await dao.deleteRetiredSources(WALLET, [ADDRESS, IDENTITY])

    const rows = await dao.getTransactions(WALLET)
    expect(rows).toHaveLength(1)
    expect(mergePlatformTransactions(rows)[0].netCredits).toBe(-100_000_000n)
    expect(await knex('platform_transaction_parts')
      .where({wallet_id: WALLET, parent_source: retired}))
      .toEqual([])
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
  it('replaces local participants when the explorer reports a transition in either case', async () => {
    await dao.upsertTransactions(`${LOCAL_SOURCE_PREFIX}${ADDRESS}`, [transaction({
      hash: HASH.toLowerCase(),
      sender: [
        {source: 'tentative-one', amount: 1n},
        {source: 'tentative-two', amount: 2n},
      ],
    })])
    await dao.upsertTransactions(ADDRESS, [transaction({
      hash: HASH,
      sender: [{source: 'authoritative', amount: 3n}],
    })])

    const rows = await dao.getTransactions(WALLET)
    expect(rows).toHaveLength(1)
    expect(rows[0].hash).toBe(HASH)
    expect(rows[0].sender).toEqual([{source: 'authoritative', amount: 3n}])
    expect(await knex('platform_transaction_parts')
      .where({wallet_id: WALLET, hash: HASH, parent_source: `${LOCAL_SOURCE_PREFIX}${ADDRESS}`}))
      .toEqual([])
  })
})
