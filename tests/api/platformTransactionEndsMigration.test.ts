import {afterEach, beforeEach, describe, expect, it} from 'vitest'
import type {Knex} from 'knex'
import {PlatformTransactionDAO} from '../../src/main/src/database/PlatformTransactionDAO'
import {CREDITS_PER_DUFF} from '../../src/main/src/constants/credits'
import * as migration0020 from '../../src/main/migrations/0020_platform_transactions'
import * as migration0021 from '../../src/main/migrations/0021_platform_transaction_ends'
import {getKnex} from '../../src/main/src/utils'

const WALLET = 'w1'
const HASH = 'A1B2C3'
const SOURCE = 'identity-1'

let knex: Knex
let dao: PlatformTransactionDAO

beforeEach(async () => {
  knex = getKnex()
  await knex.schema.createTable('wallet', table => {
    table.text('wallet_id').primary()
  })
  await knex.schema.createTable('asset_lock_fundings', table => {
    table.text('wallet_id').notNullable()
    table.text('st_hash')
    table.text('amount_duffs').notNullable()
  })
  await migration0020.up(knex)
  await knex('wallet').insert({wallet_id: WALLET})
  await knex('platform_transactions').insert({
    wallet_id: WALLET,
    hash: HASH,
    source: SOURCE,
    type: 'IDENTITY_TOP_UP',
    timestamp: 0,
    gas_credits: '0',
    net_credits: '0',
    sender: 'legacy-sender',
    recipient: 'legacy-recipient',
  })
  await knex('asset_lock_fundings').insert({
    wallet_id: WALLET,
    st_hash: HASH.toLowerCase(),
    amount_duffs: '123456789',
  })
  await migration0021.up(knex)
  dao = new PlatformTransactionDAO(knex)
})

afterEach(async () => {
  await knex.destroy()
})

describe('platform transaction end migration', () => {
  it('backfills scalar ends with the asset-lock amount', async () => {
    const amount = 123_456_789n * CREDITS_PER_DUFF

    expect(await knex('platform_transaction_ends')
      .where({wallet_id: WALLET, hash: HASH, parent_source: SOURCE})
      .orderBy('side'))
      .toEqual([
        {wallet_id: WALLET, hash: HASH, parent_source: SOURCE, side: 'recipient', entry_index: 0, end_source: 'legacy-recipient', amount_credits: amount.toString()},
        {wallet_id: WALLET, hash: HASH, parent_source: SOURCE, side: 'sender', entry_index: 0, end_source: 'legacy-sender', amount_credits: amount.toString()},
      ])

    expect(await dao.getTransactions(WALLET)).toEqual([{
      walletId: WALLET,
      hash: HASH,
      type: 'IDENTITY_TOP_UP',
      date: new Date(0),
      blockHeight: null,
      status: null,
      error: null,
      gasCredits: 0n,
      netCredits: 0n,
      amountCredits: amount,
      sender: [{source: 'legacy-sender', amount}],
      recipient: [{source: 'legacy-recipient', amount}],
    }])
  })
})
