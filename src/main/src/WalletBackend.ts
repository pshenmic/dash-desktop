import {calibratePBKDF2Iterations, getKnex, migrateKnex} from './utils'
import {dataPath, ensureDataFolder} from './utils/dataPath'
import {applyLogLevel} from './logTransport'
import {LogsFolderName, PBKDF2_TARGET_MS, PreferencesFilename, StorageFilename} from './constants/app'
import {SHIELDED_NOTES_CHECK_INTERVAL_MS} from './constants/credits'
import {PLATFORM_HISTORY_REFRESH_INTERVAL_MS} from './constants/platformExplorer'
import { WalletDAO } from './database/WalletDAO'
import { AddressDAO } from './database/AddressDAO'
import { PlatformAddressDAO } from './database/PlatformAddressDAO'
import { PlatformTransactionDAO } from './database/PlatformTransactionDAO'
import { IdentityDAO } from './database/IdentityDAO'
import { TransactionDAO } from './database/TransactionDAO'
import { ContactDAO } from './database/ContactDAO'
import { WalletService } from './services/wallet/WalletService'
import { IdentityRegistrationService } from './services/platform/IdentityRegistrationService'
import { PlatformAddressService } from './services/platform/PlatformAddressService'
import { PlatformHistoryService } from './services/platform/PlatformHistoryService'
import { PlatformTransferService } from './services/platform/PlatformTransferService'
import { ApplicationService } from './services/app/ApplicationService'
import {Preferences} from "./preferences";
import { CreateWalletHandler } from './api/wallet/manage/createWallet'
import { GetWalletAddressesHandler } from './api/wallet/core/getAddresses'
import { GetReceiveAddressHandler } from './api/wallet/core/getReceiveAddress'
import { GetStatusHandler } from './api/app/getStatus'
import { GetAllWalletsHandler } from './api/wallet/manage/getAllWallets'
import { GetTransactionsHandler } from './api/wallet/core/getTransactions'
import { GetIdentitiesHandler } from './api/wallet/platform/identity/getIdentities'
import {GetIdentityBalance} from "./api/wallet/platform/identity/getIdentityBalance";
import {GetIdentityNonce} from "./api/wallet/platform/identity/getIdentityNonce";
import {GetPlatformAddressesHandler} from "./api/wallet/platform/getPlatformAddresses";
import {AddPlatformAddressHandler} from "./api/wallet/platform/addPlatformAddress";
import {AddWalletAddressHandler} from "./api/wallet/core/addWalletAddress";
import {GetTransactionByHashHandler} from "./api/wallet/core/getTransactionByHash";
import {GetBalance} from "./api/wallet/core/getBalance";
import {DeleteWalletHandler} from "./api/wallet/manage/deleteWallet";
import {GetWalletBalance} from "./api/wallet/manage/getWalletBalance";
import {SetAddressLabel} from "./api/wallet/core/setAddressLabel";
import {SetWalletLabel} from "./api/wallet/manage/setWalletLabel";
import {SendTransactionHandler} from "./api/wallet/core/spend/sendTransaction";
import {GetTxLockStatusHandler} from "./api/wallet/core/spend/getTxLockStatus";
import {EstimateFeeHandler} from "./api/wallet/fee/estimateFee";
import {PreviewTransactionHandler} from "./api/wallet/fee/previewTransaction";
import {FeeService} from './services/wallet/FeeService'
import {SendPlatformTransferHandler} from "./api/wallet/platform/spend/sendPlatformTransfer";
import {TopUpIdentityFromAddressesHandler} from "./api/wallet/platform/identity/topUpIdentityFromAddresses";
import {WithdrawPlatformCreditsHandler} from "./api/wallet/platform/spend/withdrawPlatformCredits";
import {SendIdentityCreditsHandler} from "./api/wallet/platform/identity/spend/sendIdentityCredits";
import {TransferIdentityCreditsHandler} from "./api/wallet/platform/identity/spend/transferIdentityCredits";
import {WithdrawIdentityCreditsHandler} from "./api/wallet/platform/identity/spend/withdrawIdentityCredits";
import {CreateIdentityFromAddressesHandler} from "./api/wallet/platform/identity/createIdentityFromAddresses";
import {StartAssetLockFundingHandler} from "./api/wallet/platform/assetLock/startAssetLockFunding";
import {GetAssetLockFundingStateHandler} from "./api/wallet/platform/assetLock/getAssetLockFundingState";
import {ResumeAssetLockFundingHandler} from "./api/wallet/platform/assetLock/resumeAssetLockFunding";
import {DismissAssetLockFundingHandler} from './api/wallet/platform/assetLock/dismissAssetLockFunding'
import {AssetLockDAO} from "./database/AssetLockDAO";
import {AssetLockService} from "./services/platform/AssetLockService";
import {ShieldToPoolHandler} from "./api/wallet/platform/spend/shieldToPool";
import {SelectWallet} from "./api/wallet/manage/selectWallet";
import {VerifyWalletPasswordHandler} from "./api/wallet/credentials/verifyWalletPassword";
import {ExportMnemonicHandler} from "./api/wallet/credentials/exportMnemonic";
import {VerifyWalletMnemonicHandler} from "./api/wallet/credentials/verifyWalletMnemonic";
import {ResetWalletPasswordHandler} from "./api/wallet/credentials/resetWalletPassword";
import {SetLanguageHandler} from "./api/app/preferences/setLanguage";
import {SetLogLevelHandler} from "./api/app/logs/setLogLevel";
import {GetPreferencesHandler} from "./api/app/preferences/getPreferences";
import {ResetPreferencesHandler} from "./api/app/preferences/resetPreferences";
import {GetCollectMetricsHandler} from './api/app/logs/getCollectMetrics'
import {SetCollectMetricsHandler} from './api/app/logs/setCollectMetrics'
import {GetConnectedPeersHandler} from "./api/network/getConnectedPeers";
import {SetPeerModeHandler} from "./api/network/setPeerMode";
import {PushStaticPeerHandler} from "./api/network/peers/pushStaticPeer";
import {RemoveStaticPeerHandler} from "./api/network/peers/removeStaticPeer";
import {GetStaticPeersHandler} from "./api/network/peers/getStaticPeers";
import {SetBannedPeersHandler} from "./api/network/setBannedPeers";
import {GetBannedPeersHandler} from "./api/network/getBannedPeers";
import {SetDnsSeedsHandler} from "./api/network/setDnsSeeds";
import {GetDnsSeedsHandler} from "./api/network/getDnsSeeds";
import {SetDynamicPeersHandler} from "./api/network/peers/setDynamicPeers";
import {GetDynamicPeersHandler} from "./api/network/peers/getDynamicPeers";
import {SetDapiModeHandler} from "./api/network/dapi/setDapiMode";
import {SetDapiUrlsHandler} from "./api/network/dapi/setDapiUrls";
import {GetDapiUrlsHandler} from "./api/network/dapi/getDapiUrls";
import {GetActiveDapiUrlsHandler} from "./api/network/dapi/getActiveDapiUrls";
import {SetFiatCurrencyHandler} from "./api/app/preferences/setFiatCurrency";
import {SetPlatformFeeMultiplierHandler} from "./api/app/setPlatformFeeMultiplier";
import {SetCoreFeeMultiplierHandler} from "./api/app/setCoreFeeMultiplier";
import {SetConnectionTypeHandler} from "./api/app/preferences/setConnectionType";
import {WalletSyncService} from './services/core/WalletSyncService'
import {ShieldedService} from './services/platform/ShieldedService'
import {PlatformWorkerService} from './services/platform/PlatformWorkerService'
import {ShieldedNoteDAO} from './database/ShieldedNoteDAO'
import {ShieldedPoolDAO} from './database/ShieldedPoolDAO'
import {ShieldedAddressDAO} from './database/ShieldedAddressDAO'
import {GetShieldedStatusHandler} from './api/wallet/platform/shielded/sync/getShieldedStatus'
import {GetShieldedPoolInfoHandler} from './api/wallet/platform/shielded/getShieldedPoolInfo'
import {GetShieldedNotesInfoHandler} from './api/wallet/platform/shielded/getShieldedNotesInfo'
import {StartShieldedSyncHandler} from './api/wallet/platform/shielded/sync/startShieldedSync'
import {GetShieldedSyncStateHandler} from './api/wallet/platform/shielded/sync/getShieldedSyncState'
import {RefreshShieldedSpentNotesHandler} from './api/wallet/platform/shielded/sync/refreshShieldedSpentNotes'
import {StartShieldedTransferHandler} from './api/wallet/platform/shielded/spend/startShieldedTransfer'
import {StartShieldedUnshieldHandler} from './api/wallet/platform/shielded/spend/startShieldedUnshield'
import {StartShieldedWithdrawalHandler} from './api/wallet/platform/shielded/spend/startShieldedWithdrawal'
import {StartShieldedIdentityCreateHandler} from './api/wallet/platform/identity/startShieldedIdentityCreate'
import {GetShieldedSpendStateHandler} from './api/wallet/platform/shielded/getShieldedSpendState'
import {GetShieldedAddressHandler} from './api/wallet/platform/shielded/getShieldedAddress'
import {GetShieldedAddressesHandler} from './api/wallet/platform/shielded/getShieldedAddresses'
import {AddShieldedAddressHandler} from './api/wallet/platform/shielded/addShieldedAddress'
import {RatesService} from './services/app/RatesService'
import {GetExchangeRatesHandler} from './api/app/getExchangeRates'
import {ContactService} from './services/app/ContactService'
import {GetContactsHandler} from './api/app/contacts/getContacts'
import {AddContactHandler} from './api/app/contacts/addContact'
import {DeleteContactHandler} from './api/app/contacts/deleteContact'
import {StartWalletSyncHandler} from './api/wallet/core/sync/startWalletSync'
import {StopWalletSyncHandler} from './api/wallet/core/sync/stopWalletSync'
import {ResetWalletSyncHandler} from './api/wallet/core/sync/resetWalletSync'
import {GetUtxosHandler} from './api/wallet/core/spend/getUtxos'
import {DISCOVERY_INTERVAL_MS} from './constants/addresses'
import {CoreDiscoveryService} from './services/core/CoreDiscoveryService'
import {CorePrevOutService} from './services/core/CorePrevOutService'
import {WalletCredentialsService} from './services/wallet/WalletCredentialsService'
import {IdentityService} from './services/platform/IdentityService'
import {CoreLockService} from './services/core/CoreLockService'
import {CoreTransactionService} from './services/core/CoreTransactionService'
import {WalletProviderFactory} from './providers/WalletProviderFactory'
import {HasSyncProgressHandler} from './api/wallet/core/sync/hasSyncProgress'
import {BroadcastTransactionHandler} from './api/wallet/core/spend/broadcastTransaction'
import {LogService} from './services/app/LogService'
import {ListLogFiles} from './api/app/logs/listLogFiles'
import {GetLogFileHandler} from './api/app/logs/getLogFile'
import {ShowLogFileInFolderHandler} from './api/app/logs/showLogFileInFolder'
import {registerHandler} from './utils/ipcHandler'
import {Logger} from './utils/logger'

const prevout = new Logger('prevout')
const locks = new Logger('locks')
const discoveryLog = new Logger('discovery')
const shielded = new Logger('shielded')
const platformLog = new Logger('platform')

export class WalletBackend {
  private walletService?: WalletService
  private platformAddressService?: PlatformAddressService
  private platformHistoryService?: PlatformHistoryService
  private platformTransferService?: PlatformTransferService
  private feeService?: FeeService
  private applicationService?: ApplicationService
  private walletSyncService?: WalletSyncService
  private ratesService?: RatesService
  private contactService?: ContactService
  private identityRegistrationService?: IdentityRegistrationService
  private shieldedService?: ShieldedService
  private platformWorkerService?: PlatformWorkerService
  private assetLockService?: AssetLockService
  private coreDiscoveryService?: CoreDiscoveryService
  private coreLockService?: CoreLockService
  private walletCredentialsService?: WalletCredentialsService
  private identityService?: IdentityService
  private logService?: LogService

  private walletDAO?: WalletDAO
  private addressDAO?: AddressDAO
  private identityDAO?: IdentityDAO

  private initHandlers(): void {
    if (!this.walletService || !this.platformAddressService || !this.platformHistoryService || !this.platformTransferService || !this.feeService || !this.applicationService || !this.walletSyncService || !this.ratesService || !this.contactService || !this.shieldedService || !this.assetLockService || !this.addressDAO || !this.walletDAO || !this.identityDAO || !this.identityRegistrationService || !this.coreDiscoveryService || !this.coreLockService || !this.walletCredentialsService || !this.identityService || !this.logService || !this.platformWorkerService) {
      throw new Error('Services not initialized. Call start() first.')
    }

    registerHandler('createWallet', new CreateWalletHandler(this.walletService, this.shieldedService).handle)
    registerHandler('deleteWallet', new DeleteWalletHandler(this.walletService).handle)
    registerHandler('getAllWallets', new GetAllWalletsHandler(this.walletService).handle)
    registerHandler('selectWallet', new SelectWallet(this.walletService, this.coreDiscoveryService).handle)
    registerHandler('getWalletBalance', new GetWalletBalance(this.walletService).handle)
    registerHandler('getAddresses', new GetWalletAddressesHandler(this.walletService).handle)
    registerHandler('addWalletAddress', new AddWalletAddressHandler(this.walletService).handle)
    registerHandler('getReceiveAddress', new GetReceiveAddressHandler(this.walletService).handle)
    registerHandler('getStatus', new GetStatusHandler(this.walletService, this.applicationService, this.walletSyncService).handle)
    registerHandler('getTransactions', new GetTransactionsHandler(this.walletService).handle)
    registerHandler('getBalance', new GetBalance(this.walletService).handle)
    registerHandler("getTransactionByHash", new GetTransactionByHashHandler(this.walletService).handle)
    registerHandler('getIdentities', new GetIdentitiesHandler(this.identityService).handle)
    registerHandler('getIdentityBalance', new GetIdentityBalance(this.identityService).handle)
    registerHandler('getIdentityNonce', new GetIdentityNonce(this.identityService).handle)
    registerHandler('getPlatformAddresses', new GetPlatformAddressesHandler(this.platformAddressService).handle)
    registerHandler('addPlatformAddress', new AddPlatformAddressHandler(this.platformAddressService).handle)
    registerHandler('setAddressLabel', new SetAddressLabel(this.walletService).handle)
    registerHandler('setWalletLabel', new SetWalletLabel(this.walletService).handle)
    registerHandler('sendTransaction', new SendTransactionHandler(this.walletService).handle)
    registerHandler('getTxLockStatus', new GetTxLockStatusHandler(this.coreLockService).handle)
    registerHandler('estimateFee', new EstimateFeeHandler(this.feeService).handle)
    registerHandler('previewTransaction', new PreviewTransactionHandler(this.feeService).handle)
    registerHandler('sendPlatformTransfer', new SendPlatformTransferHandler(this.platformTransferService).handle)
    registerHandler('topUpIdentityFromAddresses', new TopUpIdentityFromAddressesHandler(this.platformTransferService).handle)
    registerHandler('withdrawPlatformCredits', new WithdrawPlatformCreditsHandler(this.platformTransferService).handle)
    registerHandler('sendIdentityCredits', new SendIdentityCreditsHandler(this.platformTransferService).handle)
    registerHandler('transferIdentityCredits', new TransferIdentityCreditsHandler(this.platformTransferService).handle)
    registerHandler('withdrawIdentityCredits', new WithdrawIdentityCreditsHandler(this.platformTransferService).handle)
    registerHandler('createIdentityFromAddresses', new CreateIdentityFromAddressesHandler(this.platformTransferService).handle)
    registerHandler('startAssetLockFunding', new StartAssetLockFundingHandler(this.platformTransferService, this.shieldedService, this.identityRegistrationService).handle)
    registerHandler('getAssetLockFundingState', new GetAssetLockFundingStateHandler(this.assetLockService).handle)
    registerHandler('resumeAssetLockFunding', new ResumeAssetLockFundingHandler(this.assetLockService, this.platformTransferService, this.shieldedService, this.identityRegistrationService).handle)
    registerHandler('dismissAssetLockFunding', new DismissAssetLockFundingHandler(this.assetLockService).handle)
    registerHandler('shieldToPool', new ShieldToPoolHandler(this.platformTransferService).handle)
    registerHandler('verifyWalletPassword', new VerifyWalletPasswordHandler(this.walletCredentialsService).handle)
    registerHandler('exportMnemonic', new ExportMnemonicHandler(this.walletCredentialsService).handle)
    registerHandler('verifyWalletMnemonic', new VerifyWalletMnemonicHandler(this.walletCredentialsService).handle)
    registerHandler('resetWalletPassword', new ResetWalletPasswordHandler(this.walletCredentialsService).handle)
    registerHandler('getPreferences', new GetPreferencesHandler(this.applicationService).handle)
    registerHandler('setLanguage', new SetLanguageHandler(this.applicationService).handle)
    registerHandler('setLogLevel', new SetLogLevelHandler(this.applicationService, this.walletSyncService, this.platformWorkerService).handle)
    registerHandler('setFiatCurrency', new SetFiatCurrencyHandler(this.applicationService).handle)
    registerHandler('setPlatformFeeMultiplier', new SetPlatformFeeMultiplierHandler(this.applicationService).handle)
    registerHandler('setCoreFeeMultiplier', new SetCoreFeeMultiplierHandler(this.applicationService).handle)
    registerHandler('getCollectMetrics', new GetCollectMetricsHandler(this.applicationService).handle)
    registerHandler('setCollectMetrics', new SetCollectMetricsHandler(this.applicationService).handle)
    registerHandler('setConnectionType', new SetConnectionTypeHandler(this.applicationService, this.walletService, this.coreDiscoveryService).handle)
    registerHandler('getConnectedPeers', new GetConnectedPeersHandler(this.walletSyncService).handle)
    registerHandler('setPeerMode', new SetPeerModeHandler(this.applicationService, this.walletSyncService).handle)
    registerHandler('pushStaticPeer', new PushStaticPeerHandler(this.applicationService, this.walletSyncService).handle)
    registerHandler('removeStaticPeer', new RemoveStaticPeerHandler(this.applicationService, this.walletSyncService).handle)
    registerHandler('getStaticPeers', new GetStaticPeersHandler(this.applicationService).handle)
    registerHandler('setBannedPeers', new SetBannedPeersHandler(this.applicationService, this.walletSyncService).handle)
    registerHandler('getBannedPeers', new GetBannedPeersHandler(this.applicationService).handle)
    registerHandler('setDnsSeeds', new SetDnsSeedsHandler(this.applicationService, this.walletSyncService).handle)
    registerHandler('getDnsSeeds', new GetDnsSeedsHandler(this.applicationService).handle)
    registerHandler('setDynamicPeers', new SetDynamicPeersHandler(this.applicationService, this.walletSyncService).handle)
    registerHandler('getDynamicPeers', new GetDynamicPeersHandler(this.applicationService).handle)
    registerHandler('setDapiMode', new SetDapiModeHandler(this.applicationService, this.platformWorkerService).handle)
    registerHandler('setDapiUrls', new SetDapiUrlsHandler(this.applicationService, this.platformWorkerService).handle)
    registerHandler('getDapiUrls', new GetDapiUrlsHandler(this.applicationService).handle)
    registerHandler('getActiveDapiUrls', new GetActiveDapiUrlsHandler(this.platformWorkerService).handle)
    registerHandler('resetPreferences', new ResetPreferencesHandler(this.applicationService).handle)
    registerHandler('startWalletSync', new StartWalletSyncHandler(this.walletSyncService).handle)
    registerHandler('stopWalletSync', new StopWalletSyncHandler(this.walletSyncService).handle)
    registerHandler('resetWalletSync', new ResetWalletSyncHandler(this.walletSyncService).handle)
    registerHandler('getUtxos', new GetUtxosHandler(this.walletService).handle)
    registerHandler('hasSyncProgress', new HasSyncProgressHandler(this.walletSyncService).handle)
    registerHandler('broadcastTransaction', new BroadcastTransactionHandler(this.walletSyncService).handle)
    registerHandler('getExchangeRates', new GetExchangeRatesHandler(this.ratesService).handle)
    registerHandler('getContacts', new GetContactsHandler(this.contactService).handle)
    registerHandler('addContact', new AddContactHandler(this.contactService).handle)
    registerHandler('deleteContact', new DeleteContactHandler(this.contactService).handle)
    registerHandler('getShieldedStatus', new GetShieldedStatusHandler(this.shieldedService).handle)
    registerHandler('getShieldedPoolInfo', new GetShieldedPoolInfoHandler(this.shieldedService).handle)
    registerHandler('getShieldedNotesInfo', new GetShieldedNotesInfoHandler(this.shieldedService).handle)
    registerHandler('startShieldedSync', new StartShieldedSyncHandler(this.shieldedService).handle)
    registerHandler('getShieldedSyncState', new GetShieldedSyncStateHandler(this.shieldedService).handle)
    registerHandler('refreshShieldedSpentNotes', new RefreshShieldedSpentNotesHandler(this.shieldedService).handle)
    registerHandler('startShieldedTransfer', new StartShieldedTransferHandler(this.shieldedService).handle)
    registerHandler('startShieldedUnshield', new StartShieldedUnshieldHandler(this.shieldedService).handle)
    registerHandler('startShieldedWithdrawal', new StartShieldedWithdrawalHandler(this.shieldedService).handle)
    registerHandler('startShieldedIdentityCreate', new StartShieldedIdentityCreateHandler(this.shieldedService).handle)
    registerHandler('getShieldedSpendState', new GetShieldedSpendStateHandler(this.shieldedService).handle)
    registerHandler('getShieldedAddress', new GetShieldedAddressHandler(this.shieldedService).handle)
    registerHandler('getShieldedAddresses', new GetShieldedAddressesHandler(this.shieldedService).handle)
    registerHandler('addShieldedAddress', new AddShieldedAddressHandler(this.shieldedService).handle)
    registerHandler('listLogFiles', new ListLogFiles(this.logService).handle)
    registerHandler('getLogFile', new GetLogFileHandler(this.logService).handle)
    registerHandler('showLogFileInFolder', new ShowLogFileInFolderHandler(this.logService).handle)
  }

  async start(): Promise<void> {
    ensureDataFolder()

    // calibrate only on start and then using until wallet running
    const calibratedIterations = calibratePBKDF2Iterations(PBKDF2_TARGET_MS)

    const preferences = await Preferences.init(dataPath(PreferencesFilename))

    // The bootstrap in main/index.ts runs before preferences exist, so until
    // here everything is logged at the default level.
    applyLogLevel(preferences.general.logLevel)

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
    this.logService = new LogService(dataPath(LogsFolderName))
    const shieldedAddressDAO = new ShieldedAddressDAO(knex)
    this.platformWorkerService = new PlatformWorkerService(preferences)
    this.platformWorkerService.start()

    // Consumers depend on the asset lock primitive, never the other way round:
    // CoreLockService funds the L1 lock, AssetLockService turns it into a proof,
    // and each consumer settles that proof into its own transition.
    const prevOuts = new CorePrevOutService(walletDAO, transactionDAO)
    const providers = new WalletProviderFactory(walletDAO, addressDAO, transactionDAO, this.applicationService, this.walletSyncService, prevOuts)
    const coreTransactionService = new CoreTransactionService()
    this.coreDiscoveryService = new CoreDiscoveryService(walletDAO, addressDAO, transactionDAO, this.walletSyncService, providers)
    this.coreLockService = new CoreLockService(walletDAO, addressDAO, this.walletSyncService, coreTransactionService, providers, preferences)
    this.walletCredentialsService = new WalletCredentialsService(walletDAO, addressDAO, calibratedIterations)
    this.identityService = new IdentityService(walletDAO, identityDAO, this.platformWorkerService)
    const platformAddressDAO = new PlatformAddressDAO(knex)
    const shieldedNoteDAO = new ShieldedNoteDAO(knex)
    const platformTransactionDAO = new PlatformTransactionDAO(knex)
    const shieldedPoolDAO = new ShieldedPoolDAO(knex)
    this.platformHistoryService = new PlatformHistoryService(walletDAO, identityDAO, platformAddressDAO, platformTransactionDAO, shieldedNoteDAO, shieldedPoolDAO)
    this.walletService = new WalletService(walletDAO, addressDAO, identityDAO, platformTransactionDAO, this.identityService, this.platformHistoryService, this.walletSyncService, this.platformWorkerService, providers, this.coreDiscoveryService, coreTransactionService, preferences, calibratedIterations)
    this.assetLockService = new AssetLockService(walletDAO, new AssetLockDAO(knex), this.coreLockService, this.platformWorkerService)
    this.shieldedService = new ShieldedService(walletDAO, identityDAO, shieldedNoteDAO, shieldedPoolDAO, shieldedAddressDAO, this.platformWorkerService, this.assetLockService, this.platformHistoryService, preferences)
    this.platformAddressService = new PlatformAddressService(walletDAO, platformAddressDAO, this.platformWorkerService)
    this.feeService = new FeeService(walletDAO, addressDAO, this.platformAddressService, this.platformWorkerService, this.shieldedService, coreTransactionService, providers, preferences)
    this.identityRegistrationService = new IdentityRegistrationService(walletDAO, identityDAO, this.assetLockService, this.platformWorkerService, this.coreLockService, this.feeService)
    this.platformTransferService = new PlatformTransferService(walletDAO, identityDAO, this.assetLockService, this.platformWorkerService, this.shieldedService, this.platformAddressService, this.feeService, preferences)
    this.walletDAO = walletDAO
    this.addressDAO = addressDAO
    this.identityDAO = identityDAO

    this.initHandlers()

    const discovery = this.coreDiscoveryService
    const walletSyncService = this.walletSyncService
    const applicationService = this.applicationService
    // A drain outlives the 3s activity debounce that triggers it, and every
    // overlapping one would re-read the same parents from DAPI.
    let resolvingPrevOuts = false
    // rpc mode reads whole transactions from the indexer, which already carries
    // what every input spends, and never displays the local rows this fills in.
    const resolvePrevOuts = (walletId: string): void => {
      if (applicationService.preferences.general.connectionType !== 'p2p' || resolvingPrevOuts) return
      resolvingPrevOuts = true
      prevOuts.resolveBacklog(walletId)
        .catch(err => prevout.error('input resolution failed:', err))
        .finally(() => { resolvingPrevOuts = false })
    }
    const discoverSelected = async (): Promise<void> => {
      const selected = await walletDAO.getSelectedWallet()
      if (selected == null) return
      // Locks are needed in both connection modes, and this is the only place
      // that starts listening for them. Re-run on the periodic tick so a lost
      // utility process is picked back up.
      try {
        await walletSyncService.startLockListen(selected.network, selected.walletId)
      } catch (err) {
        locks.error('failed to start lock listener:', err)
      }
      await discovery.discoverCoreAddresses(selected.walletId)
      resolvePrevOuts(selected.walletId)
    }
    this.walletSyncService.onWalletActivity = (walletId) => {
      discovery.discoverCoreAddresses(walletId).catch(err =>
        discoveryLog.error('post-sync address discovery failed:', err))
      resolvePrevOuts(walletId)
    }
    // The scan is stopped until this answers, so it must not join a discovery
    // run that started before the block that exhausted the gap was persisted.
    this.walletSyncService.onGapExhausted = (gap) => {
      discovery.rediscoverCoreAddresses(gap.walletId).catch(err =>
        discoveryLog.error('gap-exhausted address discovery failed:', err))
    }
    discoverSelected().catch(err => discoveryLog.error('startup address discovery failed:', err))
    setInterval(() => {
      discoverSelected().catch(err => discoveryLog.error('periodic address discovery failed:', err))
    }, DISCOVERY_INTERVAL_MS).unref()

    const shieldedService = this.shieldedService
    const fetchShieldedNotes = async (): Promise<void> => {
      const selected = await walletDAO.getSelectedWallet()
      if (selected != null) {
        await shieldedService.prefetchNotes(selected.walletId, selected.network)
      }
    }
    fetchShieldedNotes().catch(err => shielded.error('startup note fetch failed:', err))
    setInterval(() => {
      fetchShieldedNotes().catch(err => shielded.error('periodic note fetch failed:', err))
    }, SHIELDED_NOTES_CHECK_INTERVAL_MS).unref()

    // Refreshed here so a stalled explorer cannot hold up a read that shows L1.
    const platformHistoryService = this.platformHistoryService
    const refreshPlatformHistory = async (): Promise<void> => {
      const selected = await walletDAO.getSelectedWallet()
      if (selected != null) {
        await platformHistoryService.refresh(selected.walletId)
      }
    }
    refreshPlatformHistory().catch(err => platformLog.error('startup platform history refresh failed:', err))
    setInterval(() => {
      refreshPlatformHistory().catch(err => platformLog.error('periodic platform history refresh failed:', err))
    }, PLATFORM_HISTORY_REFRESH_INTERVAL_MS).unref()

    // The worker reports the broadcast, not which wallet sent: the selected one
    // is the only wallet the periodic refresh covers either.
    const refreshAfterBroadcast = async (): Promise<void> => {
      const selected = await walletDAO.getSelectedWallet()
      if (selected != null) {
        platformHistoryService.refreshAfterSend(selected.walletId)
      }
    }
    // A shielded transition says nothing to the addresses it touched beyond the
    // surplus it sent back. What it moved is in the notes a sync just decrypted.
    const shieldedHistoryService = this.platformHistoryService
    this.shieldedService.onNotesSynced(walletId => {
      shieldedHistoryService.readShieldedSides(walletId).catch(err =>
        platformLog.error('reading the shielded side of the history failed:', err))
    })

    this.platformWorkerService.onTransitionBroadcast(() => {
      refreshAfterBroadcast().catch(err => platformLog.error('platform history refresh after a broadcast failed:', err))
    })

    this.applicationService.markReady()
  }

  async shutdown(): Promise<void> {
    await this.walletSyncService?.shutdown()
    await this.platformWorkerService?.shutdown()
  }
}
