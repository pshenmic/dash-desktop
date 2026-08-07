import {vi} from 'vitest'
import {Knex} from 'knex'
import {CreateWalletHandler} from '../../src/main/src/api/wallet/createWallet'
import {WalletService} from '../../src/main/src/services/WalletService'
import {WalletSyncService} from '../../src/main/src/services/WalletSyncService'
import {ApplicationService} from '../../src/main/src/services/ApplicationService'
import {PlatformWorkerService} from '../../src/main/src/services/PlatformWorkerService'
import {ShieldedService} from '../../src/main/src/services/ShieldedService'
import {WalletDAO} from '../../src/main/src/database/WalletDAO'
import {AddressDAO} from '../../src/main/src/database/AddressDAO'
import {IdentityDAO} from '../../src/main/src/database/IdentityDAO'
import {TransactionDAO} from '../../src/main/src/database/TransactionDAO'
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
  transactionDAO: TransactionDAO
  walletService: WalletService
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
  const walletSyncService = new WalletSyncService(walletDAO, addressDAO, transactionDAO)

  const request = vi.fn().mockResolvedValue({identities: [], nextFreeIndex: 0})
  const platform = {request} as unknown as PlatformWorkerService
  const shieldedService = {getAddresses: vi.fn().mockResolvedValue([])} as unknown as ShieldedService

  const walletService = new WalletService(
    walletDAO, addressDAO, identityDAO, transactionDAO,
    applicationService, walletSyncService, platform, TEST_PBKDF2_ITERATIONS,
  )

  return {
    knex,
    walletDAO,
    addressDAO,
    transactionDAO,
    walletService,
    applicationService,
    createWalletHandler: new CreateWalletHandler(walletService, shieldedService),
    request,
  }
}