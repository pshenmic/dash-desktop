import {beforeEach, describe, expect, it} from 'vitest'
import {bytesToHex} from '@noble/hashes/utils.js'
import {Knex} from 'knex'
import {MasternodeKeyDAO} from '../../src/main/src/database/MasternodeKeyDAO'
import {WalletCredentialsService} from '../../src/main/src/services/wallet/WalletCredentialsService'
import {harness, PASSWORD, VALID_SEEDPHRASE} from './harness'

describe('masternode keys persistence', () => {
  let knex: Knex
  let masternodeKeyDAO: MasternodeKeyDAO
  let credentials: WalletCredentialsService
  let walletId: string

  beforeEach(async () => {
    const wired = await harness()
    knex = wired.knex
    masternodeKeyDAO = wired.masternodeKeyDAO
    credentials = wired.walletCredentialsService
    walletId = await wired.createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'mainnet', PASSWORD)
  })

  async function dropKeys(): Promise<void> {
    await knex('masternode_platform_keys').where('wallet_id', walletId).delete()
    await knex('masternode_keys').where('wallet_id', walletId).delete()
  }

  it('writes the provider keys when the wallet is created', async () => {
    const keys = await masternodeKeyDAO.getKeys(walletId)

    expect(bytesToHex(keys!.operatorPublicKey)).toBe('ad794d053504db3727c1f51aea2112e440fadbade687a9c0243b61523c8ab8eb64061f0a5ec5d8df4b7ec8bdfe722c19')
    expect(keys!.platformNodeKeys).toHaveLength(10)
    expect(bytesToHex(keys!.platformNodeKeys[0])).toBe('3130c14339391cf26a68d86879e180ee9a16b660f5aa91f560f67c0abe8cf789')
  })

  it('backfills a wallet that has none on the next password check', async () => {
    const created = await masternodeKeyDAO.getKeys(walletId)
    await dropKeys()

    expect(await credentials.verifyWalletPassword(walletId, PASSWORD)).toBe(true)
    expect(await masternodeKeyDAO.getKeys(walletId)).toEqual(created)
  })

  it('passes concurrent password checks that both backfill', async () => {
    await dropKeys()

    const results = await Promise.all([
      credentials.verifyWalletPassword(walletId, PASSWORD),
      credentials.verifyWalletPassword(walletId, PASSWORD),
    ])

    expect(results).toEqual([true, true])
    expect(await knex('masternode_keys').where('wallet_id', walletId).count({n: '*'})).toEqual([{n: 1}])
    expect((await masternodeKeyDAO.getKeys(walletId))!.platformNodeKeys).toHaveLength(10)
  })

  it('does not backfill on a wrong password', async () => {
    await dropKeys()

    expect(await credentials.verifyWalletPassword(walletId, 'wrong password')).toBe(false)
    expect(await masternodeKeyDAO.hasKeys(walletId)).toBe(false)
  })
})
