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
import {PLATFORM_EXPLORER_ADDRESS_SOURCE} from '../../src/main/src/constants/platformExplorer'
import {getKnex, migrateKnex} from '../../src/main/src/utils'

const WALLET = 'w1'
const ADDRESS = 'yTdAgPuFgiByksqV1Hhwgxbw3EdJRKQBwb'
const IDENTITY = 'DcoJJ3W9JauwLD51vzNuXJ9vnaZT7mprVm7wbgVYifNq'
const HASH = 'A1B2C3'

// The transition and the transfer name the same hash: one top-up, seen from the
// address that funded it and from the identity that received it.
const transition = {
  hash: HASH, index: 0, blockHash: 'bh', blockHeight: 587710, type: 'IDENTITY_TOP_UP',
  batchType: null, timestamp: '2026-01-15T16:15:33.127Z', gasUsed: 7927360, status: 'SUCCESS',
  error: null, incoming: false, amount: '-100000000', base58Address: ADDRESS,
  bech32mAddress: null, addressesCount: 1,
}

const transfer = {
  amount: '99000000', sender: null, recipient: IDENTITY, timestamp: '2026-01-15T16:15:33.127Z',
  txHash: HASH, type: 'IDENTITY_TOP_UP', blockHash: 'bh', gasUsed: 7927360,
}

const page = (resultSet: unknown[]): Response =>
  ({ok: true, status: 200, json: async () => ({resultSet, pagination: {page: 1, limit: 100, total: resultSet.length}})} as Response)

let responder: (path: string) => Response
let knex: Knex
let service: PlatformHistoryService
let transactionDAO: PlatformTransactionDAO

beforeEach(async () => {
  net.paths.length = 0
  responder = (path) => page(path.startsWith('/identity/') ? [transfer] : [transition])

  knex = getKnex()
  await migrateKnex(knex)
  await knex('wallet').insert({wallet_id: WALLET, network: 'testnet', encrypted_mnemonic: 'm'})

  const platformAddressDAO = new PlatformAddressDAO(knex)
  const identityDAO = new IdentityDAO(knex)
  transactionDAO = new PlatformTransactionDAO(knex)

  await platformAddressDAO.insertAddresses([
    {walletId: WALLET, index: 0, address: ADDRESS, derivationPath: "m/9'/1'/17'/0'/0'/0", isUsed: true},
  ])
  await identityDAO.insertIdentity(
    {walletId: WALLET, identityIndex: 0, derivationPath: "m/9'/1'/5'/0'/0", identifier: IDENTITY},
    null,
  )

  service = new PlatformHistoryService(new WalletDAO(knex), identityDAO, platformAddressDAO, transactionDAO)
})

afterEach(async () => {
  await knex.destroy()
})

describe('platform history', () => {
  it('stores what the explorer returned and folds the two sides into one row', async () => {
    const transactions = await service.getPlatformTransactions(WALLET)

    expect(transactions).toHaveLength(1)
    expect(transactions[0].hash).toBe(HASH)
    // -100000000 from the address, +99000000 into the identity: the gap is the fee.
    expect(transactions[0].netCredits).toBe(-1_000_000n)
    expect(await transactionDAO.getTransactions(WALLET)).toHaveLength(2)
    expect(await transactionDAO.getKnownHashes(WALLET, PLATFORM_EXPLORER_ADDRESS_SOURCE)).toEqual(new Set([HASH]))
    expect(await transactionDAO.getKnownHashes(WALLET, IDENTITY)).toEqual(new Set([HASH]))
  })

  it('asks each source for one page once its rows are known', async () => {
    await service.getPlatformTransactions(WALLET)
    net.paths.length = 0

    await service.getPlatformTransactions(WALLET)

    expect(net.paths.filter(path => path.startsWith('/platformAddresses'))).toHaveLength(1)
    expect(net.paths.filter(path => path.startsWith('/identity/'))).toHaveLength(1)
  })

  it('picks up a transition the previous walk was too early to see', async () => {
    await service.getPlatformTransactions(WALLET)
    responder = (path) => path.startsWith('/identity/')
      ? page([transfer])
      : page([{...transition, hash: 'NEWER', timestamp: '2026-02-01T00:00:00.000Z'}, transition])

    expect((await service.getPlatformTransactions(WALLET)).map(row => row.hash)).toEqual(['NEWER', HASH])
  })

  it('serves stored rows when the explorer stops answering', async () => {
    await service.getPlatformTransactions(WALLET)
    responder = () => { throw new Error('offline') }

    expect((await service.getPlatformTransactions(WALLET)).map(row => row.hash)).toEqual([HASH])
  })

  it('reports the failure when it has nothing stored to serve', async () => {
    responder = () => { throw new Error('offline') }

    await expect(service.getPlatformTransactions(WALLET)).rejects.toThrow(/Platform explorer request failed/)
  })
})
