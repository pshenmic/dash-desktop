import {afterEach, beforeEach, describe, expect, it} from 'vitest'
import type {Knex} from 'knex'
import {getKnex, migrateKnex} from '../../src/main/src/utils'
import {IdentityDAO} from '../../src/main/src/database/IdentityDAO'
import {IdentityKeyDAO} from '../../src/main/src/database/IdentityKeyDAO'
import {WalletDAO} from '../../src/main/src/database/WalletDAO'

const WALLET_ID = 'wallet-1'
const IDENTITY_ID = '4EfA9Jrvv3nnCFdSf7fad59851iiTRZ6Wcu6YVJ4iSeF'

describe('imported identity key storage', () => {
  let knex: Knex

  beforeEach(async () => {
    knex = getKnex()
    await migrateKnex(knex)
    await knex('wallet').insert({
      wallet_id: WALLET_ID,
      network: 'testnet',
      encrypted_mnemonic: 'encrypted',
      selected: true,
    })
  })

  afterEach(async () => {
    await knex.destroy()
  })

  it('stores the identity and its encrypted keys atomically', async () => {
    const keyDAO = new IdentityKeyDAO(knex)
    await keyDAO.insertImportedIdentity({
      walletId: WALLET_ID,
      identityIndex: -1,
      derivationPath: '',
      identifier: IDENTITY_ID,
      isImported: true,
    }, [{
      walletId: WALLET_ID,
      identityIdentifier: IDENTITY_ID,
      keyId: 3,
      publicKeyHash: 'abcd',
      encryptedPrivateKey: 'encrypted-key',
    }])

    const identities = await new IdentityDAO(knex).getIdentitiesByWalletId(WALLET_ID)
    expect(identities).toEqual([expect.objectContaining({
      identifier: IDENTITY_ID,
      isImported: true,
    })])
    expect(await keyDAO.getByIdentity(WALLET_ID, IDENTITY_ID)).toEqual([expect.objectContaining({
      keyId: 3,
      encryptedPrivateKey: 'encrypted-key',
    })])
  })

  it('removes imported keys when their wallet is deleted', async () => {
    const keyDAO = new IdentityKeyDAO(knex)
    await keyDAO.insertImportedIdentity({
      walletId: WALLET_ID,
      identityIndex: -1,
      derivationPath: '',
      identifier: IDENTITY_ID,
      isImported: true,
    }, [{
      walletId: WALLET_ID,
      identityIdentifier: IDENTITY_ID,
      keyId: 3,
      publicKeyHash: 'abcd',
      encryptedPrivateKey: 'encrypted-key',
    }])

    expect((await new WalletDAO(knex).deleteWallet(WALLET_ID)).success).toBe(true)
    expect(await knex('identity_keys').count<{count: number}>({count: '*'}).first()).toEqual({count: 0})
  })
})
