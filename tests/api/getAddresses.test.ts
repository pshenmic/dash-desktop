import {describe, it, expect, beforeEach, vi} from 'vitest'
import {SdkProvider} from '../../src/main/src/providers/SdkProvider'
import {GetWalletAddressesHandler} from '../../src/main/src/api/wallet/getAddresses'
import {CreateWalletHandler} from '../../src/main/src/api/wallet/createWallet'
import {WalletService} from '../../src/main/src/services/WalletService'
import {WalletSyncService} from '../../src/main/src/services/WalletSyncService'
import type {ShieldedService} from '../../src/main/src/services/ShieldedService'
import {ApplicationService} from '../../src/main/src/services/ApplicationService'
import {WalletDAO} from '../../src/main/src/database/WalletDAO'
import {AddressDAO} from '../../src/main/src/database/AddressDAO'
import {IdentityDAO} from '../../src/main/src/database/IdentityDAO'
import {TransactionDAO} from '../../src/main/src/database/TransactionDAO'
import {Preferences} from '../../src/main/src/preferences'
import {getKnex, migrateKnex} from '../../src/main/src/utils'

const VALID_SEEDPHRASE = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const PASSWORD = 'password123'
const TEST_PBKDF2_ITERATIONS = 1_000

describe('GetWalletAddressesHandler', () => {
  let handler: GetWalletAddressesHandler
  let createWalletHandler: CreateWalletHandler

  beforeEach(async () => {
    const knex = getKnex()
    await migrateKnex(knex)

    const walletDAO = new WalletDAO(knex)
    const addressDAO = new AddressDAO(knex)
    const identityDAO = new IdentityDAO(knex)
    const transactionDAO = new TransactionDAO(knex)

    const sdkProvider = new SdkProvider()
    const sdk = sdkProvider.getPlatformSDK('testnet')
    vi.spyOn(sdk.identities, 'getIdentityByPublicKeyHash').mockRejectedValue(new Error('offline test'))
    vi.spyOn(sdk.identities, 'getIdentityByNonUniquePublicKeyHash').mockRejectedValue(new Error('offline test'))

    // p2p mode → getBalance reads from local SQL (empty here, always 0n) so
    // the handler does not need network access during the test.
    const preferences = Preferences.default()
    preferences.general.connectionType = 'p2p'
    const applicationService = new ApplicationService(preferences)
    const walletSyncService = new WalletSyncService(walletDAO, addressDAO, transactionDAO)
    const shieldedService = {
      initAddresses: vi.fn().mockResolvedValue(undefined),
    } as unknown as ShieldedService

    const walletService = new WalletService(
      walletDAO, addressDAO, identityDAO, transactionDAO,
      applicationService, walletSyncService, sdkProvider, TEST_PBKDF2_ITERATIONS, shieldedService,
    )

    createWalletHandler = new CreateWalletHandler(walletService, addressDAO, walletSyncService)
    handler = new GetWalletAddressesHandler(walletService)
  })

  it('returns 20 receiving and 20 change addresses for a fresh wallet', async () => {
    const walletId = await createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)

    const grouped = await handler.handle(null as never, walletId)

    expect(grouped.receiving).toHaveLength(20)
    expect(grouped.change).toHaveLength(20)
  })

  it('returns addresses scoped to the requested wallet', async () => {
    const walletId = await createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)

    const grouped = await handler.handle(null as never, walletId)

    for (const a of [...grouped.receiving, ...grouped.change]) {
      expect(a.walletId).toBe(walletId)
    }
  })

  it('annotates a zero balance for an unsynced wallet in p2p mode', async () => {
    const walletId = await createWalletHandler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)

    const grouped = await handler.handle(null as never, walletId)

    for (const a of [...grouped.receiving, ...grouped.change]) {
      expect(a.balance).toBe(0n)
    }
  })

  it('throws for an unknown walletId', async () => {
    await expect(
      handler.handle(null as never, 'nonexistent'),
    ).rejects.toThrow('Wallet not found')
  })
})
