import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import type {Knex} from 'knex'
import {PlatformTransactionDAO} from '../../src/main/src/database/PlatformTransactionDAO'
import {getKnex, migrateKnex} from '../../src/main/src/utils'

const WALLET = 'w1'
const LOCK_TXID = 'a'.repeat(64)
const ST_HASH = 'B'.repeat(64)

let knex: Knex
let dao: PlatformTransactionDAO

const funding = (overrides: Record<string, unknown> = {}) => ({
  wallet_id: WALLET,
  txid: LOCK_TXID,
  output_index: 0,
  credit_derivation_path: "m/9'/1'/5'/1'/0",
  amount_duffs: '100000',
  to_platform_address: 'oursL2',
  status: 'done',
  st_hash: ST_HASH,
  created_at: 0,
  kind: 'address',
  ...overrides,
})

beforeEach(async () => {
  knex = getKnex()
  await migrateKnex(knex)
  await knex('wallet').insert({wallet_id: WALLET, network: 'testnet', encrypted_mnemonic: 'm'})
  dao = new PlatformTransactionDAO(knex)
})

afterEach(async () => { await knex.destroy() })

describe('attributing a transition to the asset lock that funded it', () => {
  it('finds the funding txid whatever case the hash is stored in', async () => {
    await knex('asset_lock_fundings').insert(funding())
    const txids = await dao.getAssetLockTxids(WALLET)

    expect(txids.get(ST_HASH.toLowerCase())).toBe(LOCK_TXID)
  })

  // A funding still waiting on its lock has no transition to attribute yet.
  it('leaves out a funding that has not reached its transition', async () => {
    await knex('asset_lock_fundings').insert(funding({status: 'l1_broadcast', st_hash: null}))

    expect(await dao.getAssetLockTxids(WALLET)).toEqual(new Map())
  })

  it('does not attribute another wallet\'s funding', async () => {
    await knex('wallet').insert({wallet_id: 'w2', network: 'testnet', encrypted_mnemonic: 'm2'})
    await knex('asset_lock_fundings').insert(funding({wallet_id: 'w2'}))

    expect(await dao.getAssetLockTxids(WALLET)).toEqual(new Map())
  })
})
