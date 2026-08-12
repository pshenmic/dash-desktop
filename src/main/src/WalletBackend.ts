import {calibratePBKDF2Iterations, getKnex, migrateKnex} from './utils'
import {dataPath, ensureDataFolder} from './utils/dataPath'
import {LogsFolderName, PBKDF2_TARGET_MS, PreferencesFilename, SHIELDED_NOTES_CHECK_INTERVAL_MS, StorageFilename} from './constants'
import { ipcMain } from 'electron'
import { WalletDAO } from './database/WalletDAO'
import { AddressDAO } from './database/AddressDAO'
import { IdentityDAO } from './database/IdentityDAO'
import { TransactionDAO } from './database/TransactionDAO'
import { ContactDAO } from './database/ContactDAO'
import { WalletService } from './services/wallet/WalletService'
import { IdentityRegistrationService } from './services/platform/IdentityRegistrationService'
import { PlatformAddressService } from './services/platform/PlatformAddressService'
import { ApplicationService } from './services/app/ApplicationService'
import {Preferences} from "./preferences";
import { CreateWalletHandler } from './api/wallet/createWallet'
import { GetWalletAddressesHandler } from './api/wallet/getAddresses'
import { GetReceiveAddressHandler } from './api/wallet/getReceiveAddress'
import { GetStatusHandler } from './api/getStatus'
import { GetAllWalletsHandler } from './api/wallet/getAllWallets'
import { GetTransactionsHandler } from './api/wallet/getTransactions'
import { GetIdentitiesHandler } from './api/wallet/getIdentities'
import {GetIdentityBalance} from "./api/wallet/getIdentityBalance";
import {GetIdentityNonce} from "./api/wallet/getIdentityNonce";
import {GetPlatformAddressesHandler} from "./api/wallet/getPlatformAddresses";
import {AddPlatformAddressHandler} from "./api/wallet/addPlatformAddress";
import {AddWalletAddressHandler} from "./api/wallet/addWalletAddress";
import {GetTransactionByHashHandler} from "./api/wallet/getTransactionByHash";
import {GetBalance} from "./api/wallet/getBalance";
import {DeleteWalletHandler} from "./api/wallet/deleteWallet";
import {GetWalletBalance} from "./api/wallet/getWalletBalance";
import {SetAddressLabel} from "./api/wallet/setAddressLabel";
import {SetWalletLabel} from "./api/wallet/setWalletLabel";
import {SendTransactionHandler} from "./api/wallet/sendTransaction";
import {GetTxLockStatusHandler} from "./api/wallet/getTxLockStatus";
import {EstimateTransitionFeeHandler} from "./api/wallet/estimateTransitionFee";
import {SendPlatformTransferHandler} from "./api/wallet/sendPlatformTransfer";
import {TopUpIdentityFromAddressesHandler} from "./api/wallet/topUpIdentityFromAddresses";
import {WithdrawPlatformCreditsHandler} from "./api/wallet/withdrawPlatformCredits";
import {SendIdentityCreditsHandler} from "./api/wallet/sendIdentityCredits";
import {TransferIdentityCreditsHandler} from "./api/wallet/transferIdentityCredits";
import {WithdrawIdentityCreditsHandler} from "./api/wallet/withdrawIdentityCredits";
import {CreateIdentityFromAddressesHandler} from "./api/wallet/createIdentityFromAddresses";
import {StartAssetLockFundingHandler} from "./api/wallet/startAssetLockFunding";
import {GetAssetLockFundingStateHandler} from "./api/wallet/getAssetLockFundingState";
import {ResumeAssetLockFundingHandler} from "./api/wallet/resumeAssetLockFunding";
import {AssetLockDAO} from "./database/AssetLockDAO";
import {AssetLockService} from "./services/platform/AssetLockService";
import {ShieldToPoolHandler} from "./api/wallet/shieldToPool";
import {SelectWallet} from "./api/wallet/selectWallet";
import {VerifyWalletPasswordHandler} from "./api/wallet/verifyWalletPassword";
import {ExportMnemonicHandler} from "./api/wallet/exportMnemonic";
import {VerifyWalletMnemonicHandler} from "./api/wallet/verifyWalletMnemonic";
import {ResetWalletPasswordHandler} from "./api/wallet/resetWalletPassword";
import {SetLanguageHandler} from "./api/setLanguage";
import {GetPreferencesHandler} from "./api/getPreferences";
import {ResetPreferencesHandler} from "./api/resetPreferences";
import {SetFiatCurrencyHandler} from "./api/setFiatCurrency";
import {SetConnectionTypeHandler} from "./api/setConnectionType";
import {WalletSyncService} from './services/core/WalletSyncService'
import {ShieldedService} from './services/platform/ShieldedService'
import {PlatformWorkerService} from './services/platform/PlatformWorkerService'
import {ShieldedNoteDAO} from './database/ShieldedNoteDAO'
import {ShieldedPoolDAO} from './database/ShieldedPoolDAO'
import {ShieldedAddressDAO} from './database/ShieldedAddressDAO'
import {GetShieldedStatusHandler} from './api/shielded/getShieldedStatus'
import {GetShieldedPoolInfoHandler} from './api/shielded/getShieldedPoolInfo'
import {GetShieldedNotesInfoHandler} from './api/shielded/getShieldedNotesInfo'
import {StartShieldedSyncHandler} from './api/shielded/startShieldedSync'
import {GetShieldedSyncStateHandler} from './api/shielded/getShieldedSyncState'
import {StartShieldedTransferHandler} from './api/shielded/startShieldedTransfer'
import {StartShieldedUnshieldHandler} from './api/shielded/startShieldedUnshield'
import {StartShieldedWithdrawalHandler} from './api/shielded/startShieldedWithdrawal'
import {StartShieldedIdentityCreateHandler} from './api/shielded/startShieldedIdentityCreate'
import {GetShieldedSpendStateHandler} from './api/shielded/getShieldedSpendState'
import {GetShieldedAddressHandler} from './api/shielded/getShieldedAddress'
import {GetShieldedAddressesHandler} from './api/shielded/getShieldedAddresses'
import {AddShieldedAddressHandler} from './api/shielded/addShieldedAddress'
import {RatesService} from './services/app/RatesService'
import {GetExchangeRatesHandler} from './api/getExchangeRates'
import {ContactService} from './services/app/ContactService'
import {GetContactsHandler} from './api/contacts/getContacts'
import {AddContactHandler} from './api/contacts/addContact'
import {DeleteContactHandler} from './api/contacts/deleteContact'
import {StartWalletSyncHandler} from './api/walletSync/startWalletSync'
import {StopWalletSyncHandler} from './api/walletSync/stopWalletSync'
import {ResetWalletSyncHandler} from './api/walletSync/resetWalletSync'
import {GetUtxosHandler} from './api/walletSync/getUtxos'
import {DISCOVERY_INTERVAL_MS} from './constants'
import {CoreDiscoveryService} from './services/core/CoreDiscoveryService'
import {WalletCredentialsService} from './services/wallet/WalletCredentialsService'
import {IdentityService} from './services/platform/IdentityService'
import {CoreLockService} from './services/core/CoreLockService'
import {CoreTransactionService} from './services/core/CoreTransactionService'
import {WalletProviderFactory} from './providers/WalletProviderFactory'
import {HasSyncProgressHandler} from './api/walletSync/hasSyncProgress'
import {BroadcastTransactionHandler} from './api/walletSync/broadcastTransaction'
import {LogService} from './services/LogService'
import {GetLogFilesHandler} from './api/logs/getLogFiles'
import {GetLogFileHandler} from './api/logs/getLogFile'
import {SaveLogFileHandler} from './api/logs/saveLogFile'


export class WalletBackend {
  private walletService?: WalletService
  private platformAddressService?: PlatformAddressService
  private applicationService?: ApplicationService
  private walletSyncService?: WalletSyncService
  private ratesService?: RatesService
  private contactService?: ContactService
  private identityRegistrationService?: IdentityRegistrationService
  private shieldedService?: ShieldedService
  private readonly platformWorkerService = new PlatformWorkerService()
  private assetLockService?: AssetLockService
  private coreDiscoveryService?: CoreDiscoveryService
  private coreLockService?: CoreLockService
  private walletCredentialsService?: WalletCredentialsService
  private identityService?: IdentityService
  private readonly logService = new LogService(dataPath(LogsFolderName))

  private walletDAO?: WalletDAO
  private addressDAO?: AddressDAO
  private identityDAO?: IdentityDAO

  private initHandlers(): void {
    if (!this.walletService || !this.platformAddressService || !this.applicationService || !this.walletSyncService || !this.ratesService || !this.contactService || !this.shieldedService || !this.assetLockService || !this.addressDAO || !this.walletDAO || !this.identityDAO || !this.identityRegistrationService || !this.coreDiscoveryService || !this.coreLockService || !this.walletCredentialsService || !this.identityService) {
      throw new Error('Services not initialized. Call start() first.')
    }

    ipcMain.handle('createWallet', new CreateWalletHandler(this.walletService, this.shieldedService).handle)
    ipcMain.handle('deleteWallet', new DeleteWalletHandler(this.walletService).handle)
    ipcMain.handle('getAllWallets', new GetAllWalletsHandler(this.walletService).handle)
    ipcMain.handle('selectWallet', new SelectWallet(this.walletService, this.coreDiscoveryService).handle)
    ipcMain.handle('getWalletBalance', new GetWalletBalance(this.walletService).handle)
    ipcMain.handle('getAddresses', new GetWalletAddressesHandler(this.walletService).handle)
    ipcMain.handle('addWalletAddress', new AddWalletAddressHandler(this.walletService).handle)
    ipcMain.handle('getReceiveAddress', new GetReceiveAddressHandler(this.walletService).handle)
    ipcMain.handle('getStatus', new GetStatusHandler(this.walletService, this.applicationService, this.walletSyncService).handle)
    ipcMain.handle('getTransactions', new GetTransactionsHandler(this.walletService).handle)
    ipcMain.handle('getBalance', new GetBalance(this.walletService).handle)
    ipcMain.handle("getTransactionByHash", new GetTransactionByHashHandler(this.walletService).handle)
    ipcMain.handle('getIdentities', new GetIdentitiesHandler(this.identityService).handle)
    ipcMain.handle('getIdentityBalance', new GetIdentityBalance(this.identityService).handle)
    ipcMain.handle('getIdentityNonce', new GetIdentityNonce(this.identityService).handle)
    ipcMain.handle('getPlatformAddresses', new GetPlatformAddressesHandler(this.platformAddressService).handle)
    ipcMain.handle('addPlatformAddress', new AddPlatformAddressHandler(this.platformAddressService).handle)
    ipcMain.handle('setAddressLabel', new SetAddressLabel(this.walletService).handle)
    ipcMain.handle('setWalletLabel', new SetWalletLabel(this.walletService).handle)
    ipcMain.handle('sendTransaction', new SendTransactionHandler(this.walletService).handle)
    ipcMain.handle('getTxLockStatus', new GetTxLockStatusHandler(this.coreLockService).handle)
    ipcMain.handle('estimateTransitionFee', new EstimateTransitionFeeHandler(this.platformAddressService).handle)
    ipcMain.handle('sendPlatformTransfer', new SendPlatformTransferHandler(this.platformAddressService).handle)
    ipcMain.handle('topUpIdentityFromAddresses', new TopUpIdentityFromAddressesHandler(this.platformAddressService).handle)
    ipcMain.handle('withdrawPlatformCredits', new WithdrawPlatformCreditsHandler(this.platformAddressService).handle)
    ipcMain.handle('sendIdentityCredits', new SendIdentityCreditsHandler(this.platformAddressService).handle)
    ipcMain.handle('transferIdentityCredits', new TransferIdentityCreditsHandler(this.platformAddressService).handle)
    ipcMain.handle('withdrawIdentityCredits', new WithdrawIdentityCreditsHandler(this.platformAddressService).handle)
    ipcMain.handle('createIdentityFromAddresses', new CreateIdentityFromAddressesHandler(this.platformAddressService).handle)
    ipcMain.handle('startAssetLockFunding', new StartAssetLockFundingHandler(this.platformAddressService, this.shieldedService, this.identityRegistrationService).handle)
    ipcMain.handle('getAssetLockFundingState', new GetAssetLockFundingStateHandler(this.assetLockService).handle)
    ipcMain.handle('resumeAssetLockFunding', new ResumeAssetLockFundingHandler(this.assetLockService, this.platformAddressService, this.shieldedService, this.identityRegistrationService).handle)
    ipcMain.handle('shieldToPool', new ShieldToPoolHandler(this.platformAddressService).handle)
    ipcMain.handle('verifyWalletPassword', new VerifyWalletPasswordHandler(this.walletCredentialsService).handle)
    ipcMain.handle('exportMnemonic', new ExportMnemonicHandler(this.walletCredentialsService).handle)
    ipcMain.handle('verifyWalletMnemonic', new VerifyWalletMnemonicHandler(this.walletCredentialsService).handle)
    ipcMain.handle('resetWalletPassword', new ResetWalletPasswordHandler(this.walletCredentialsService).handle)
    ipcMain.handle('getPreferences', new GetPreferencesHandler(this.applicationService).handle)
    ipcMain.handle('setLanguage', new SetLanguageHandler(this.applicationService).handle)
    ipcMain.handle('setFiatCurrency', new SetFiatCurrencyHandler(this.applicationService).handle)
    ipcMain.handle('setConnectionType', new SetConnectionTypeHandler(this.applicationService, this.walletService, this.coreDiscoveryService).handle)
    ipcMain.handle('resetPreferences', new ResetPreferencesHandler(this.applicationService).handle)
    ipcMain.handle('startWalletSync', new StartWalletSyncHandler(this.walletSyncService).handle)
    ipcMain.handle('stopWalletSync', new StopWalletSyncHandler(this.walletSyncService).handle)
    ipcMain.handle('resetWalletSync', new ResetWalletSyncHandler(this.walletSyncService).handle)
    ipcMain.handle('getUtxos', new GetUtxosHandler(this.walletSyncService).handle)
    ipcMain.handle('hasSyncProgress', new HasSyncProgressHandler(this.walletSyncService).handle)
    ipcMain.handle('broadcastTransaction', new BroadcastTransactionHandler(this.walletSyncService).handle)
    ipcMain.handle('getExchangeRates', new GetExchangeRatesHandler(this.ratesService).handle)
    ipcMain.handle('getContacts', new GetContactsHandler(this.contactService).handle)
    ipcMain.handle('addContact', new AddContactHandler(this.contactService).handle)
    ipcMain.handle('deleteContact', new DeleteContactHandler(this.contactService).handle)
    ipcMain.handle('getShieldedStatus', new GetShieldedStatusHandler(this.shieldedService).handle)
    ipcMain.handle('getShieldedPoolInfo', new GetShieldedPoolInfoHandler(this.shieldedService).handle)
    ipcMain.handle('getShieldedNotesInfo', new GetShieldedNotesInfoHandler(this.shieldedService).handle)
    ipcMain.handle('startShieldedSync', new StartShieldedSyncHandler(this.shieldedService).handle)
    ipcMain.handle('getShieldedSyncState', new GetShieldedSyncStateHandler(this.shieldedService).handle)
    ipcMain.handle('startShieldedTransfer', new StartShieldedTransferHandler(this.shieldedService).handle)
    ipcMain.handle('startShieldedUnshield', new StartShieldedUnshieldHandler(this.shieldedService).handle)
    ipcMain.handle('startShieldedWithdrawal', new StartShieldedWithdrawalHandler(this.shieldedService).handle)
    ipcMain.handle('startShieldedIdentityCreate', new StartShieldedIdentityCreateHandler(this.shieldedService).handle)
    ipcMain.handle('getShieldedSpendState', new GetShieldedSpendStateHandler(this.shieldedService).handle)
    ipcMain.handle('getShieldedAddress', new GetShieldedAddressHandler(this.shieldedService).handle)
    ipcMain.handle('getShieldedAddresses', new GetShieldedAddressesHandler(this.shieldedService).handle)
    ipcMain.handle('addShieldedAddress', new AddShieldedAddressHandler(this.shieldedService).handle)
    ipcMain.handle('getLogFiles', new GetLogFilesHandler(this.logService).handle)
    ipcMain.handle('getLogFile', new GetLogFileHandler(this.logService).handle)
    ipcMain.handle('saveLogFile', new SaveLogFileHandler(this.logService).handle)
  }

  async start(): Promise<void> {
    ensureDataFolder()

    // calibrate only on start and then using until wallet running
    const calibratedIterations = calibratePBKDF2Iterations(PBKDF2_TARGET_MS)

    const preferences = await Preferences.init(dataPath(PreferencesFilename))

    const knex = getKnex(dataPath(StorageFilename))

    await migrateKnex(knex)

    const walletDAO = new WalletDAO(knex)
    const addressDAO = new AddressDAO(knex)
    const identityDAO = new IdentityDAO(knex)
    const transactionDAO = new TransactionDAO(knex)
    const contactDAO = new ContactDAO(knex)

    this.applicationService = new ApplicationService(preferences)
    this.walletSyncService = new WalletSyncService(walletDAO, addressDAO, transactionDAO, preferences)
    this.ratesService = new RatesService()
    this.contactService = new ContactService(contactDAO)
    const shieldedAddressDAO = new ShieldedAddressDAO(knex)
    this.platformWorkerService.start()

    // Consumers depend on the asset lock primitive, never the other way round:
    // CoreLockService funds the L1 lock, AssetLockService turns it into a proof,
    // and each consumer settles that proof into its own transition.
    const providers = new WalletProviderFactory(walletDAO, addressDAO, transactionDAO, this.applicationService, this.walletSyncService)
    const coreTransactionService = new CoreTransactionService()
    this.coreDiscoveryService = new CoreDiscoveryService(walletDAO, addressDAO, transactionDAO, this.walletSyncService, providers)
    this.coreLockService = new CoreLockService(walletDAO, addressDAO, this.walletSyncService, coreTransactionService, providers)
    this.walletCredentialsService = new WalletCredentialsService(walletDAO, addressDAO, calibratedIterations)
    this.identityService = new IdentityService(walletDAO, identityDAO, this.platformWorkerService)
    this.walletService = new WalletService(walletDAO, addressDAO, identityDAO, this.identityService, this.walletSyncService, this.platformWorkerService, providers, this.coreDiscoveryService, coreTransactionService, calibratedIterations)
    this.assetLockService = new AssetLockService(walletDAO, new AssetLockDAO(knex), this.coreLockService, this.platformWorkerService)
    this.identityRegistrationService = new IdentityRegistrationService(walletDAO, identityDAO, this.assetLockService, this.platformWorkerService, this.coreLockService)
    this.shieldedService = new ShieldedService(walletDAO, identityDAO, new ShieldedNoteDAO(knex), new ShieldedPoolDAO(knex), shieldedAddressDAO, this.identityRegistrationService, this.platformWorkerService, this.assetLockService)
    this.platformAddressService = new PlatformAddressService(walletDAO, identityDAO, this.assetLockService, this.platformWorkerService, this.shieldedService)
    this.walletDAO = walletDAO
    this.addressDAO = addressDAO
    this.identityDAO = identityDAO

    this.initHandlers()

    const discovery = this.coreDiscoveryService
    const walletSyncService = this.walletSyncService
    const discoverSelected = async (): Promise<void> => {
      const selected = await walletDAO.getSelectedWallet()
      if (selected == null) return
      // Locks are needed in both connection modes, and this is the only place
      // that starts listening for them. Re-run on the periodic tick so a lost
      // utility process is picked back up.
      try {
        await walletSyncService.startLockListen(selected.network, selected.walletId)
      } catch (err) {
        console.error('[locks] failed to start lock listener:', err)
      }
      await discovery.discoverCoreAddresses(selected.walletId)
    }
    this.walletSyncService.onWalletActivity = (walletId) => {
      discovery.discoverCoreAddresses(walletId).catch(err =>
        console.error('[discovery] post-sync address discovery failed:', err))
    }
    // The scan is stopped until this answers, so it must not join a discovery
    // run that started before the block that exhausted the gap was persisted.
    this.walletSyncService.onGapExhausted = (gap) => {
      discovery.rediscoverCoreAddresses(gap.walletId).catch(err =>
        console.error('[discovery] gap-exhausted address discovery failed:', err))
    }
    discoverSelected().catch(err => console.error('[discovery] startup address discovery failed:', err))
    setInterval(() => {
      discoverSelected().catch(err => console.error('[discovery] periodic address discovery failed:', err))
    }, DISCOVERY_INTERVAL_MS).unref()

    const shieldedService = this.shieldedService
    const fetchShieldedNotes = async (): Promise<void> => {
      const selected = await walletDAO.getSelectedWallet()
      if (selected != null) {
        await shieldedService.prefetchNotes(selected.walletId, selected.network)
      }
    }
    fetchShieldedNotes().catch(err => console.error('[shielded] startup note fetch failed:', err))
    setInterval(() => {
      fetchShieldedNotes().catch(err => console.error('[shielded] periodic note fetch failed:', err))
    }, SHIELDED_NOTES_CHECK_INTERVAL_MS).unref()

    this.applicationService.markReady()
  }

  async shutdown(): Promise<void> {
    await this.walletSyncService?.shutdown()
    await this.platformWorkerService.shutdown()
  }
}
