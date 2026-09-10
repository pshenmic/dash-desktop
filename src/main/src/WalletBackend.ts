import {calibratePBKDF2Iterations, getKnex, migrateKnex} from './utils'
import {dataPath, ensureDataFolder} from './utils/dataPath'
import {applyLogLevel} from './logTransport'
import {LogsFolderName, PBKDF2_TARGET_MS, PreferencesFilename, StorageFilename} from './constants/app'
import {SHIELDED_NOTES_CHECK_INTERVAL_MS} from './constants/credits'
import { WalletDAO } from './database/WalletDAO'
import { AddressDAO } from './database/AddressDAO'
import { PlatformAddressDAO } from './database/PlatformAddressDAO'
import { IdentityDAO } from './database/IdentityDAO'
import { TransactionDAO } from './database/TransactionDAO'
import { ContactDAO } from './database/ContactDAO'
import { WalletService } from './services/wallet/WalletService'
import { IdentityRegistrationService } from './services/platform/IdentityRegistrationService'
import { PlatformAddressService } from './services/platform/PlatformAddressService'
import { PlatformTransferService } from './services/platform/PlatformTransferService'
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
import {EstimateFeeHandler} from "./api/wallet/estimateFee";
import {PreviewTransactionHandler} from "./api/wallet/previewTransaction";
import {FeeService} from './services/wallet/FeeService'
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
import {DismissAssetLockFundingHandler} from './api/wallet/dismissAssetLockFunding'
import {AssetLockDAO} from "./database/AssetLockDAO";
import {AssetLockService} from "./services/platform/AssetLockService";
import {ShieldToPoolHandler} from "./api/wallet/shieldToPool";
import {SelectWallet} from "./api/wallet/selectWallet";
import {VerifyWalletPasswordHandler} from "./api/wallet/verifyWalletPassword";
import {ExportMnemonicHandler} from "./api/wallet/exportMnemonic";
import {VerifyWalletMnemonicHandler} from "./api/wallet/verifyWalletMnemonic";
import {ResetWalletPasswordHandler} from "./api/wallet/resetWalletPassword";
import {SetLanguageHandler} from "./api/setLanguage";
import {SetLogLevelHandler} from "./api/setLogLevel";
import {GetPreferencesHandler} from "./api/getPreferences";
import {ResetPreferencesHandler} from "./api/resetPreferences";
import {GetConnectedPeersHandler} from "./api/getConnectedPeers";
import {SetPeerModeHandler} from "./api/setPeerMode";
import {PushStaticPeerHandler} from "./api/pushStaticPeer";
import {RemoveStaticPeerHandler} from "./api/removeStaticPeer";
import {GetStaticPeersHandler} from "./api/getStaticPeers";
import {SetBannedPeersHandler} from "./api/setBannedPeers";
import {GetBannedPeersHandler} from "./api/getBannedPeers";
import {SetDnsSeedsHandler} from "./api/setDnsSeeds";
import {GetDnsSeedsHandler} from "./api/getDnsSeeds";
import {SetDynamicPeersHandler} from "./api/setDynamicPeers";
import {GetDynamicPeersHandler} from "./api/getDynamicPeers";
import {SetFiatCurrencyHandler} from "./api/setFiatCurrency";
import {SetPlatformFeeMultiplierHandler} from "./api/setPlatformFeeMultiplier";
import {SetCoreFeeMultiplierHandler} from "./api/setCoreFeeMultiplier";
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
import {RefreshShieldedSpentNotesHandler} from './api/shielded/refreshShieldedSpentNotes'
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
import {GetUtxosHandler} from './api/wallet/getUtxos'
import {DISCOVERY_INTERVAL_MS} from './constants/addresses'
import {CoreDiscoveryService} from './services/core/CoreDiscoveryService'
import {CorePrevOutService} from './services/core/CorePrevOutService'
import {WalletCredentialsService} from './services/wallet/WalletCredentialsService'
import {IdentityService} from './services/platform/IdentityService'
import {CoreLockService} from './services/core/CoreLockService'
import {CoreTransactionService} from './services/core/CoreTransactionService'
import {WalletProviderFactory} from './providers/WalletProviderFactory'
import {HasSyncProgressHandler} from './api/walletSync/hasSyncProgress'
import {BroadcastTransactionHandler} from './api/walletSync/broadcastTransaction'
import {LogService} from './services/app/LogService'
import {ListLogFiles} from './api/logs/listLogFiles'
import {GetLogFileHandler} from './api/logs/getLogFile'
import {ShowLogFileInFolderHandler} from './api/logs/showLogFileInFolder'
import {registerHandler} from './utils/ipcHandler'
import {Logger} from './utils/logger'

const prevout = new Logger('prevout')
const locks = new Logger('locks')
const discoveryLog = new Logger('discovery')
const shielded = new Logger('shielded')

export class WalletBackend {
  private walletService?: WalletService
  private platformAddressService?: PlatformAddressService
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
    if (!this.walletService || !this.platformAddressService || !this.platformTransferService || !this.feeService || !this.applicationService || !this.walletSyncService || !this.ratesService || !this.contactService || !this.shieldedService || !this.assetLockService || !this.addressDAO || !this.walletDAO || !this.identityDAO || !this.identityRegistrationService || !this.coreDiscoveryService || !this.coreLockService || !this.walletCredentialsService || !this.identityService || !this.logService || !this.platformWorkerService) {
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
    this.platformWorkerService = new PlatformWorkerService()
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
    this.walletService = new WalletService(walletDAO, addressDAO, identityDAO, this.identityService, this.walletSyncService, this.platformWorkerService, providers, this.coreDiscoveryService, coreTransactionService, preferences, calibratedIterations)
    this.assetLockService = new AssetLockService(walletDAO, new AssetLockDAO(knex), this.coreLockService, this.platformWorkerService)
    this.shieldedService = new ShieldedService(walletDAO, identityDAO, new ShieldedNoteDAO(knex), new ShieldedPoolDAO(knex), shieldedAddressDAO, this.platformWorkerService, this.assetLockService, preferences)
    this.platformAddressService = new PlatformAddressService(walletDAO, new PlatformAddressDAO(knex), this.platformWorkerService)
    this.feeService = new FeeService(walletDAO, addressDAO, this.platformAddressService, this.platformWorkerService, this.shieldedService, providers, preferences)
    this.identityRegistrationService = new IdentityRegistrationService(walletDAO, identityDAO, this.assetLockService, this.platformWorkerService, this.coreLockService, this.feeService)
    this.platformTransferService = new PlatformTransferService(walletDAO, identityDAO, this.assetLockService, this.platformAddressService, this.platformWorkerService, this.shieldedService, this.feeService, preferences)
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

    this.applicationService.markReady()
  }

  async shutdown(): Promise<void> {
    await this.walletSyncService?.shutdown()
    await this.platformWorkerService?.shutdown()
  }
}
