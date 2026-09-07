import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import type {Knex} from 'knex'
import type {AppliedTx} from '../../src/main/p2p/types/walletSync'
import {AddressDAO} from '../../src/main/src/database/AddressDAO'
import {PlatformAddressDAO} from '../../src/main/src/database/PlatformAddressDAO'
import {ShieldedAddressDAO} from '../../src/main/src/database/ShieldedAddressDAO'
import {ShieldedNoteDAO} from '../../src/main/src/database/ShieldedNoteDAO'
import {TransactionDAO} from '../../src/main/src/database/TransactionDAO'
import {getKnex, migrateKnex} from '../../src/main/src/utils'

// Knex builds a multi-row sqlite insert as one `select` term per row, and
// SQLITE_MAX_COMPOUND_SELECT rejects the statement past 500 of them. A restored
// wallet whose last used index sits far above the derived window reveals more
// than that in a single write.
const OVER_LIMIT = 600
const WALLET = 'w1'

let knex: Knex

beforeEach(async () => {
  knex = getKnex()
  await migrateKnex(knex)
  await knex('wallet').insert({wallet_id: WALLET, network: 'testnet', encrypted_mnemonic: 'm'})
})

afterEach(async () => {
  await knex.destroy()
})

const indexes = Array.from({length: OVER_LIMIT}, (_, index) => index)

describe('bulk inserts past the compound-select limit', () => {
  it('reveals core addresses', async () => {
    await new AddressDAO(knex).insertAddresses(indexes.map(index => ({
      walletId: WALLET,
      accountId: 0,
      address: `core-${index}`,
      derivationPath: `m/44'/1'/0'/1/${index}`,
      index,
      isChange: true,
      isUsed: false,
      label: null,
    })))

    const {change} = await new AddressDAO(knex).getAddressesByWalletId(WALLET)
    expect(change).toHaveLength(OVER_LIMIT)
  })

  it('reveals platform addresses', async () => {
    const dao = new PlatformAddressDAO(knex)
    await dao.insertAddresses(indexes.map(index => ({
      walletId: WALLET,
      index,
      address: `platform-${index}`,
      derivationPath: `m/9'/1'/17'/0'/0'/${index}`,
      isUsed: false,
    })))

    expect(await dao.getAddresses(WALLET)).toHaveLength(OVER_LIMIT)
  })

  it('reveals shielded addresses', async () => {
    const dao = new ShieldedAddressDAO(knex)
    await dao.insertAddresses(indexes.map(index => ({
      walletId: WALLET,
      index,
      address: `shielded-${index}`,
      isUsed: false,
    })))

    expect(await dao.getAddresses(WALLET)).toHaveLength(OVER_LIMIT)
  })

  it('upserts shielded notes', async () => {
    const dao = new ShieldedNoteDAO(knex)
    await dao.upsertNotes(WALLET, indexes.map(index => ({
      index,
      amount: 1000n,
      address: `shielded-${index}`,
      spent: false,
    })))

    expect(await dao.getOwnedNotes(WALLET)).toHaveLength(OVER_LIMIT)
  })

  it('applies a block whose tx carries more outputs than the limit', async () => {
    const tx: AppliedTx = {
      txid: 'tx1',
      raw: new Uint8Array([1]),
      inputs: indexes.map(vin => ({vin, prevTxid: `prev-${vin}`, prevVout: 0, sequence: 0})),
      outputs: indexes.map(vout => ({vout, address: `core-${vout}`, satoshis: '1000', isMine: true})),
    }

    await new TransactionDAO(knex).applyBlock({
      walletId: WALLET,
      height: 10,
      blockHash: 'hash',
      blockTime: 0,
      txs: [tx],
      spends: [],
    })

    const outputs = await knex('transaction_outputs').where({wallet_id: WALLET}).count('* as count').first()
    const inputs = await knex('transaction_inputs').where({wallet_id: WALLET}).count('* as count').first()
    expect(Number(outputs?.count)).toBe(OVER_LIMIT)
    expect(Number(inputs?.count)).toBe(OVER_LIMIT)
  })
})
