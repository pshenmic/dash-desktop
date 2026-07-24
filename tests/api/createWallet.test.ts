import {describe, it, expect, beforeEach, vi} from 'vitest'
import {SdkProvider} from '../../src/main/src/providers/SdkProvider'
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
// Low iteration count keeps PBKDF2 fast for tests; production calibrates this per machine.
const TEST_PBKDF2_ITERATIONS = 1_000

describe('CreateWalletHandler', () => {
  let handler: CreateWalletHandler
  let walletDAO: WalletDAO
  let addressDAO: AddressDAO

  beforeEach(async () => {
    const knex = getKnex()
    await migrateKnex(knex)

    walletDAO = new WalletDAO(knex)
    addressDAO = new AddressDAO(knex)
    const identityDAO = new IdentityDAO(knex)
    const transactionDAO = new TransactionDAO(knex)

    const sdkProvider = new SdkProvider()
    const sdk = sdkProvider.getPlatformSDK('testnet')
    // Short-circuit identity discovery so wallet creation stays offline.
    // WalletService.createWallet catches these errors and proceeds.
    vi.spyOn(sdk.identities, 'getIdentityByPublicKeyHash').mockRejectedValue(new Error('offline test'))
    vi.spyOn(sdk.identities, 'getIdentityByNonUniquePublicKeyHash').mockRejectedValue(new Error('offline test'))

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

    handler = new CreateWalletHandler(walletService, addressDAO, walletSyncService)
  })

  it('returns an 8-char hex walletId', async () => {
    const walletId = await handler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)
    expect(walletId).toMatch(/^[0-9a-f]{8}$/)
  })

  it('persists the wallet with encrypted mnemonic', async () => {
    const walletId = await handler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)

    const wallet = await walletDAO.getWalletById(walletId)

    expect(wallet).not.toBeNull()
    expect(wallet!.walletId).toBe(walletId)
    expect(wallet!.network).toBe('testnet')
    expect(wallet!.label).toBeNull()
    expect(wallet!.encryptedMnemonic).toMatch(/^[0-9a-f]+$/)
  })

  it('inserts 40 addresses (20 receiving + 20 change)', async () => {
    const walletId = await handler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)

    const {receiving, change} = await addressDAO.getAddressesByWalletId(walletId)

    expect(receiving).toHaveLength(20)
    expect(change).toHaveLength(20)
  })

  it('generates testnet receiving addresses with the BIP-44 testnet path', async () => {
    const walletId = await handler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)

    const {receiving} = await addressDAO.getAddressesByWalletId(walletId)

    receiving.forEach((a, i) => {
      expect(a.isChange).toBe(false)
      expect(a.derivationPath).toBe(`m/44'/1'/0'/0/${i}`)
    })
  })

  it('generates testnet change addresses with the BIP-44 testnet path', async () => {
    const walletId = await handler.handle(null as never, VALID_SEEDPHRASE, 'testnet', PASSWORD)

    const {change} = await addressDAO.getAddressesByWalletId(walletId)

    change.forEach((a, i) => {
      expect(a.isChange).toBe(true)
      expect(a.derivationPath).toBe(`m/44'/1'/0'/1/${i}`)
    })
  })

  it('uses coin type 5 for mainnet', async () => {
    const walletId = await handler.handle(null as never, VALID_SEEDPHRASE, 'mainnet', PASSWORD)

    const {receiving} = await addressDAO.getAddressesByWalletId(walletId)

    expect(receiving[0].derivationPath).toMatch(/^m\/44'\/5'\//)
  })

  it('rejects a seedphrase with wrong word count', async () => {
    await expect(
      handler.handle(null as never, 'too short', 'testnet', PASSWORD),
    ).rejects.toThrow('Seedphrase must be 12, 15, 18, 21, or 24 words')
  })

  it('rejects an invalid network', async () => {
    await expect(
      handler.handle(null as never, VALID_SEEDPHRASE, 'invalidnet' as never, PASSWORD),
    ).rejects.toThrow('Invalid network')
  })
})
