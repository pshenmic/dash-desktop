import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import type {Knex} from 'knex'
import {PlatformTransactionDAO} from '../../src/main/src/database/PlatformTransactionDAO'
import {PLATFORM_EXPLORER_ADDRESS_SOURCE} from '../../src/main/src/constants/platformExplorer'
import {PlatformTransaction} from '../../src/main/src/types/PlatformTransaction'
import {mergePlatformTransactions} from '../../src/main/src/utils/platformExplorerTransactions'
import {getKnex, migrateKnex} from '../../src/main/src/utils'

const WALLET = 'w1'
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

const transaction = (overrides: Partial<PlatformTransaction> = {}): PlatformTransaction => ({
  walletId: WALLET,
  hash: HASH,
  type: 'IDENTITY_TOP_UP',
  date: new Date('2026-01-15T16:15:33.127Z'),
  blockHeight: 587710,
  status: 'SUCCESS',
  error: null,
  gasCredits: 13_407_020n,
  netCredits: -100_000_000n,
  subject: 'yTdAgPuFgiByksqV1Hhwgxbw3EdJRKQBwb',
  counterparty: null,
  ...overrides,
})

describe('cached platform transactions', () => {
  it('round-trips credits and the millisecond timestamp', async () => {
    const stored = transaction({netCredits: 9_007_199_254_740_993n})
    await dao.upsertTransactions(PLATFORM_EXPLORER_ADDRESS_SOURCE, [stored])

    expect(await dao.getTransactions(WALLET)).toEqual([stored])
  })

  it('keeps the two sides of one transition apart and folds them on read', async () => {
    await dao.upsertTransactions(PLATFORM_EXPLORER_ADDRESS_SOURCE, [transaction({netCredits: -100_000_000n})])
    await dao.upsertTransactions(IDENTITY, [transaction({
      netCredits: 99_000_000n,
      blockHeight: null,
      status: null,
      subject: IDENTITY,
    })])

    const rows = await dao.getTransactions(WALLET)
    expect(rows).toHaveLength(2)

    const [merged] = mergePlatformTransactions(rows)
    expect(merged.netCredits).toBe(-1_000_000n)
    expect(merged.blockHeight).toBe(587710)
    expect(merged.subject).toBeNull()
  })

  it('counts a re-read page once', async () => {
    await dao.upsertTransactions(PLATFORM_EXPLORER_ADDRESS_SOURCE, [transaction()])
    await dao.upsertTransactions(PLATFORM_EXPLORER_ADDRESS_SOURCE, [transaction()])

    expect(mergePlatformTransactions(await dao.getTransactions(WALLET))[0].netCredits).toBe(-100_000_000n)
  })

  it('fills in what an early read was too soon to carry', async () => {
    await dao.upsertTransactions(PLATFORM_EXPLORER_ADDRESS_SOURCE, [transaction({blockHeight: null, status: null})])
    await dao.upsertTransactions(PLATFORM_EXPLORER_ADDRESS_SOURCE, [transaction()])

    const [row] = await dao.getTransactions(WALLET)
    expect(row.blockHeight).toBe(587710)
    expect(row.status).toBe('SUCCESS')
  })

  it('reports known hashes per source, so one walk cannot stop the other', async () => {
    await dao.upsertTransactions(PLATFORM_EXPLORER_ADDRESS_SOURCE, [transaction()])

    expect(await dao.getKnownHashes(WALLET, PLATFORM_EXPLORER_ADDRESS_SOURCE)).toEqual(new Set([HASH]))
    expect(await dao.getKnownHashes(WALLET, IDENTITY)).toEqual(new Set())
  })

  it('returns newest first', async () => {
    await dao.upsertTransactions(PLATFORM_EXPLORER_ADDRESS_SOURCE, [
      transaction({hash: 'older', date: new Date('2025-01-12T08:07:25.094Z')}),
      transaction({hash: 'newer', date: new Date('2026-09-17T00:01:51.733Z')}),
    ])

    expect((await dao.getTransactions(WALLET)).map(row => row.hash)).toEqual(['newer', 'older'])
  })
})
