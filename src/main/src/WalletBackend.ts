import {calibratePBKDF2Iterations, ensureHomeFolder, getKnex, migrateKnex} from './utils'
import path from 'path'
import os from 'os'
import {HomeFolderName, PBKDF2_TARGET_MS, PreferencesFilename, StorageFilename} from './constants'
import { SdkProvider } from './services/SdkProvider'
import { ipcMain } from 'electron'
import { WalletDAO } from './database/WalletDAO'
import { AddressDAO } from './database/AddressDAO'
import { IdentityDAO } from './database/IdentityDAO'
import { TransactionDAO } from './database/TransactionDAO'
import { ContactDAO } from './database/ContactDAO'
import { WalletService } from './services/WalletService'
import { IdentityRegistrationService } from './services/IdentityRegistrationService'
import { PlatformAddressService } from './services/PlatformAddressService'
import { ApplicationService } from './services/ApplicationService'
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
import {GetTransactionByHashHandler} from "./api/wallet/getTransactionByHash";
import {GetBlockByHash} from "./api/wallet/getBlockByHash";
import {GetBalance} from "./api/wallet/getBalance";
import {DeleteWalletHandler} from "./api/wallet/deleteWallet";
import {GetWalletBalance} from "./api/wallet/getWalletBalance";
import {SetAddressLabel} from "./api/wallet/setAddressLabel";
import {SetWalletLabel} from "./api/wallet/setWalletLabel";
import {SendTransactionHandler} from "./api/wallet/sendTransaction";
import {SendPlatformTransferHandler} from "./api/wallet/sendPlatformTransfer";
import {TopUpIdentityFromAddressesHandler} from "./api/wallet/topUpIdentityFromAddresses";
import {WithdrawPlatformCreditsHandler} from "./api/wallet/withdrawPlatformCredits";
import {SendIdentityCreditsHandler} from "./api/wallet/sendIdentityCredits";
import {TransferIdentityCreditsHandler} from "./api/wallet/transferIdentityCredits";
import {CreateIdentityFromAddressesHandler} from "./api/wallet/createIdentityFromAddresses";
import {StartAssetLockFundingHandler} from "./api/wallet/startAssetLockFunding";
import {GetAssetLockFundingStateHandler} from "./api/wallet/getAssetLockFundingState";
import {ResumeAssetLockFundingHandler} from "./api/wallet/resumeAssetLockFunding";
import {AssetLockDAO} from "./database/AssetLockDAO";
import {AssetLockService} from "./services/AssetLockService";
import {ShieldToPoolHandler} from "./api/wallet/shieldToPool";
import {SelectWallet} from "./api/wallet/selectWallet";
import {VerifyWalletPasswordHandler} from "./api/wallet/verifyWalletPassword";
import {ExportMnemonicHandler} from "./api/wallet/exportMnemonic";
import {SetLanguageHandler} from "./api/setLanguage";
import {GetPreferencesHandler} from "./api/getPreferences";
import {ResetPreferencesHandler} from "./api/resetPreferences";
import {SetFiatCurrencyHandler} from "./api/setFiatCurrency";
import {SetConnectionTypeHandler} from "./api/setConnectionType";
import {WalletSyncService} from './services/WalletSyncService'
import {ShieldedService} from './services/ShieldedService'
import {ShieldedNoteDAO} from './database/ShieldedNoteDAO'
import {GetShieldedStatusHandler} from './api/shielded/getShieldedStatus'
import {GetShieldedPoolInfoHandler} from './api/shielded/getShieldedPoolInfo'
import {StartShieldedSyncHandler} from './api/shielded/startShieldedSync'
import {GetShieldedSyncStateHandler} from './api/shielded/getShieldedSyncState'
import {StartShieldedTransferHandler} from './api/shielded/startShieldedTransfer'
import {StartShieldedUnshieldHandler} from './api/shielded/startShieldedUnshield'
import {StartShieldedWithdrawalHandler} from './api/shielded/startShieldedWithdrawal'
import {GetShieldedSpendStateHandler} from './api/shielded/getShieldedSpendState'
import {GetShieldedAddressHandler} from './api/shielded/getShieldedAddress'
import {GetShieldedAddressesHandler} from './api/shielded/getShieldedAddresses'
import {AddShieldedAddressHandler} from './api/shielded/addShieldedAddress'
import {RatesService} from './services/RatesService'
import {GetExchangeRatesHandler} from './api/getExchangeRates'
import {ContactService} from './services/ContactService'
import {GetContactsHandler} from './api/contacts/getContacts'
import {AddContactHandler} from './api/contacts/addContact'
import {DeleteContactHandler} from './api/contacts/deleteContact'
import {StartWalletSyncHandler} from './api/walletSync/startWalletSync'
import {StopWalletSyncHandler} from './api/walletSync/stopWalletSync'
import {ResetWalletSyncHandler} from './api/walletSync/resetWalletSync'
import {GetUtxosHandler} from './api/walletSync/getUtxos'
import {HasSyncProgressHandler} from './api/walletSync/hasSyncProgress'
import {BroadcastTransactionHandler} from './api/walletSync/broadcastTransaction'


export class WalletBackend {
  private walletService?: WalletService
  private platformAddressService?: PlatformAddressService
  private applicationService?: ApplicationService
  private walletSyncService?: WalletSyncService
  private ratesService?: RatesService
  private contactService?: ContactService
  private identityRegistrationService?: IdentityRegistrationService
  private sdkProvider?: SdkProvider
  private shieldedService?: ShieldedService
  private assetLockService?: AssetLockService

  private walletDAO?: WalletDAO
  private addressDAO?: AddressDAO
  private identityDAO?: IdentityDAO

  private initHandlers(): void {
    if (!this.walletService || !this.platformAddressService || !this.applicationService || !this.walletSyncService || !this.ratesService || !this.contactService || !this.shieldedService || !this.assetLockService || !this.addressDAO || !this.walletDAO || !this.identityDAO || !this.sdkProvider || !this.identityRegistrationService) {
      throw new Error('Services not initialized. Call start() first.')
    }

    ipcMain.handle('createWallet', new CreateWalletHandler(this.walletService, this.addressDAO, this.walletSyncService).handle)
    ipcMain.handle('deleteWallet', new DeleteWalletHandler(this.walletService).handle)
    ipcMain.handle('getAllWallets', new GetAllWalletsHandler(this.walletService).handle)
    ipcMain.handle('selectWallet', new SelectWallet(this.walletService).handle)
    ipcMain.handle('getWalletBalance', new GetWalletBalance(this.walletService).handle)
    ipcMain.handle('getAddresses', new GetWalletAddressesHandler(this.walletService).handle)
    ipcMain.handle('getReceiveAddress', new GetReceiveAddressHandler(this.walletService).handle)
    ipcMain.handle('getStatus', new GetStatusHandler(this.walletService, this.applicationService, this.walletSyncService).handle)
    ipcMain.handle('getTransactions', new GetTransactionsHandler(this.walletService).handle)
    ipcMain.handle('getBalance', new GetBalance(this.walletService).handle)
    ipcMain.handle("getTransactionByHash", new GetTransactionByHashHandler(this.walletService).handle)
    ipcMain.handle('getIdentities', new GetIdentitiesHandler(this.walletService).handle)
    ipcMain.handle('getIdentityBalance', new GetIdentityBalance(this.walletService).handle)
    ipcMain.handle('getIdentityNonce', new GetIdentityNonce(this.walletService).handle)
    ipcMain.handle('getPlatformAddresses', new GetPlatformAddressesHandler(this.platformAddressService).handle)
    ipcMain.handle('getBlockByHash', new GetBlockByHash(this.walletService).handle)
    ipcMain.handle('setAddressLabel', new SetAddressLabel(this.walletService).handle)
    ipcMain.handle('setWalletLabel', new SetWalletLabel(this.walletService).handle)
    ipcMain.handle('sendTransaction', new SendTransactionHandler(this.walletService).handle)
    ipcMain.handle('sendPlatformTransfer', new SendPlatformTransferHandler(this.platformAddressService).handle)
    ipcMain.handle('topUpIdentityFromAddresses', new TopUpIdentityFromAddressesHandler(this.platformAddressService).handle)
    ipcMain.handle('withdrawPlatformCredits', new WithdrawPlatformCreditsHandler(this.platformAddressService).handle)
    ipcMain.handle('sendIdentityCredits', new SendIdentityCreditsHandler(this.platformAddressService).handle)
    ipcMain.handle('transferIdentityCredits', new TransferIdentityCreditsHandler(this.platformAddressService).handle)
    ipcMain.handle('createIdentityFromAddresses', new CreateIdentityFromAddressesHandler(this.platformAddressService).handle)
    ipcMain.handle('startAssetLockFunding', new StartAssetLockFundingHandler(this.assetLockService).handle)
    ipcMain.handle('getAssetLockFundingState', new GetAssetLockFundingStateHandler(this.assetLockService).handle)
    ipcMain.handle('resumeAssetLockFunding', new ResumeAssetLockFundingHandler(this.assetLockService).handle)
    ipcMain.handle('shieldToPool', new ShieldToPoolHandler(this.platformAddressService).handle)
    ipcMain.handle('verifyWalletPassword', new VerifyWalletPasswordHandler(this.walletService).handle)
    ipcMain.handle('exportMnemonic', new ExportMnemonicHandler(this.walletService).handle)
    ipcMain.handle('getPreferences', new GetPreferencesHandler(this.applicationService).handle)
    ipcMain.handle('setLanguage', new SetLanguageHandler(this.applicationService).handle)
    ipcMain.handle('setFiatCurrency', new SetFiatCurrencyHandler(this.applicationService).handle)
    ipcMain.handle('setConnectionType', new SetConnectionTypeHandler(this.applicationService).handle)
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
    ipcMain.handle('startShieldedSync', new StartShieldedSyncHandler(this.shieldedService).handle)
    ipcMain.handle('getShieldedSyncState', new GetShieldedSyncStateHandler(this.shieldedService).handle)
    ipcMain.handle('startShieldedTransfer', new StartShieldedTransferHandler(this.shieldedService).handle)
    ipcMain.handle('startShieldedUnshield', new StartShieldedUnshieldHandler(this.shieldedService).handle)
    ipcMain.handle('startShieldedWithdrawal', new StartShieldedWithdrawalHandler(this.shieldedService).handle)
    ipcMain.handle('getShieldedSpendState', new GetShieldedSpendStateHandler(this.shieldedService).handle)
    ipcMain.handle('getShieldedAddress', new GetShieldedAddressHandler(this.shieldedService).handle)
    ipcMain.handle('getShieldedAddresses', new GetShieldedAddressesHandler(this.shieldedService).handle)
    ipcMain.handle('addShieldedAddress', new AddShieldedAddressHandler(this.shieldedService).handle)
  }

  async start(): Promise<void> {
    ensureHomeFolder()

    // calibrate only on start and then using until wallet running
    const calibratedIterations = calibratePBKDF2Iterations(PBKDF2_TARGET_MS)

    const preferences = await Preferences.init(path.join(os.homedir(), HomeFolderName, PreferencesFilename))

    const knex = getKnex(path.join(os.homedir(), HomeFolderName, StorageFilename))

    await migrateKnex(knex)

    const walletDAO = new WalletDAO(knex)
    const addressDAO = new AddressDAO(knex)
    const identityDAO = new IdentityDAO(knex)
    const transactionDAO = new TransactionDAO(knex)
    const contactDAO = new ContactDAO(knex)
    const sdkProvider = new SdkProvider()


    this.applicationService = new ApplicationService(preferences)
    this.walletSyncService = new WalletSyncService(walletDAO, addressDAO, transactionDAO)
    this.ratesService = new RatesService()
    this.contactService = new ContactService(contactDAO)
    this.shieldedService = new ShieldedService(sdkProvider, walletDAO, new ShieldedNoteDAO(knex))
    this.walletService = new WalletService(walletDAO, addressDAO, identityDAO, transactionDAO, this.applicationService, this.walletSyncService, sdkProvider, calibratedIterations)
    this.platformAddressService = new PlatformAddressService(walletDAO, identityDAO, sdkProvider, this.shieldedService)
    this.identityRegistrationService = new IdentityRegistrationService(sdkProvider)
    this.assetLockService = new AssetLockService(walletDAO, identityDAO, new AssetLockDAO(knex), this.walletService, this.shieldedService, sdkProvider, this.identityRegistrationService)
    this.sdkProvider = sdkProvider
    this.walletDAO = walletDAO
    this.addressDAO = addressDAO
    this.identityDAO = identityDAO

    this.initHandlers()

    this.applicationService.markReady()
  }

  async shutdown(): Promise<void> {
    await this.walletSyncService?.shutdown()
    await this.shieldedService?.shutdown()
  }
}
