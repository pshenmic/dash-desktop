import {vi} from 'vitest'
import {Knex} from 'knex'
import {CreateWalletHandler} from '../../src/main/src/api/wallet/createWallet'
import {WalletService} from '../../src/main/src/services/wallet/WalletService'
import {WalletSyncService} from '../../src/main/src/services/core/WalletSyncService'
import {ApplicationService} from '../../src/main/src/services/app/ApplicationService'
import {PlatformWorkerService} from '../../src/main/src/services/platform/PlatformWorkerService'
import {ShieldedService} from '../../src/main/src/services/platform/ShieldedService'
import {WalletDAO} from '../../src/main/src/database/WalletDAO'
import {AddressDAO} from '../../src/main/src/database/AddressDAO'
import {IdentityDAO} from '../../src/main/src/database/IdentityDAO'
import {TransactionDAO} from '../../src/main/src/database/TransactionDAO'
import {CoreDiscoveryService} from '../../src/main/src/services/core/CoreDiscoveryService'
import {WalletCredentialsService} from '../../src/main/src/services/wallet/WalletCredentialsService'
import {IdentityService} from '../../src/main/src/services/platform/IdentityService'
import {CoreLockService} from '../../src/main/src/services/core/CoreLockService'
import {CoreTransactionService} from '../../src/main/src/services/core/CoreTransactionService'
import {WalletProviderFactory} from '../../src/main/src/providers/WalletProviderFactory'
import {Preferences} from '../../src/main/src/preferences'
import {getKnex, migrateKnex} from '../../src/main/src/utils'

export const VALID_SEEDPHRASE = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
export const PASSWORD = 'password123'
// Production calibrates this per machine; a low count keeps PBKDF2 off the
// critical path of every test.
const TEST_PBKDF2_ITERATIONS = 1_000

export interface Harness {
  knex: Knex
  walletDAO: WalletDAO
  addressDAO: AddressDAO
  identityDAO: IdentityDAO
  transactionDAO: TransactionDAO
  walletService: WalletService
  providers: WalletProviderFactory
  coreDiscoveryService: CoreDiscoveryService
  coreLockService: CoreLockService
  walletCredentialsService: WalletCredentialsService
  identityService: IdentityService
  applicationService: ApplicationService
  createWalletHandler: CreateWalletHandler
  request: ReturnType<typeof vi.fn>
}

// Wires the real service graph against an in-memory database, with the two
// edges that would leave the process stubbed: the platform worker (never
// forked) and shielded address derivation (needs the prover).
export async function harness(): Promise<Harness> {
  const knex = getKnex()
  await migrateKnex(knex)

  const walletDAO = new WalletDAO(knex)
  const addressDAO = new AddressDAO(knex)
  const identityDAO = new IdentityDAO(knex)
  const transactionDAO = new TransactionDAO(knex)

  // p2p mode keeps address discovery on the local SQL store, so nothing in a
  // test reaches for the Dashscan API.
  const preferences = Preferences.default()
  preferences.general.connectionType = 'p2p'
  const applicationService = new ApplicationService(preferences)
  const walletSyncService = new WalletSyncService(walletDAO, addressDAO, transactionDAO, preferences)

  const request = vi.fn().mockResolvedValue({identities: [], nextFreeIndex: 0})
  const platform = {request} as unknown as PlatformWorkerService
  const shieldedService = {getAddresses: vi.fn().mockResolvedValue([])} as unknown as ShieldedService

  const providers = new WalletProviderFactory(walletDAO, addressDAO, transactionDAO, applicationService, walletSyncService)
  const coreTransactionService = new CoreTransactionService()
  const coreDiscoveryService = new CoreDiscoveryService(walletDAO, addressDAO, transactionDAO, walletSyncService, providers)
  const coreLockService = new CoreLockService(walletDAO, addressDAO, walletSyncService, coreTransactionService, providers)

  const walletCredentialsService = new WalletCredentialsService(walletDAO, addressDAO, TEST_PBKDF2_ITERATIONS)
  const identityService = new IdentityService(walletDAO, identityDAO, platform)

  const walletService = new WalletService(
    walletDAO, addressDAO, identityDAO, identityService, walletSyncService, platform,
    providers, coreDiscoveryService, coreTransactionService, TEST_PBKDF2_ITERATIONS,
  )

  return {
    knex,
    walletDAO,
    addressDAO,
    identityDAO,
    transactionDAO,
    walletService,
    providers,
    coreDiscoveryService,
    coreLockService,
    walletCredentialsService,
    identityService,
    applicationService,
    createWalletHandler: new CreateWalletHandler(walletService, shieldedService),
    request,
  }
}