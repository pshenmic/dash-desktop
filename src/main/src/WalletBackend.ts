import {calibratePBKDF2Iterations, ensureHomeFolder, getKnex, migrateKnex} from './utils'
import path from 'path'
import os from 'os'
import {HomeFolderName, PBKDF2_TARGET_MS, PreferencesFilename, StorageFilename} from './constants'
import { DashPlatformSDK } from 'dash-platform-sdk'
import { ipcMain } from 'electron'
import { WalletDAO } from './database/WalletDAO'
import { AddressDAO } from './database/AddressDAO'
import { IdentityDAO } from './database/IdentityDAO'
import { WalletService } from './services/WalletService'
import { AddressesService } from './services/AddressesService'
import { ApplicationService } from './services/ApplicationService'
import { CreateWalletHandler } from './api/wallet/createWallet'
import { GetWalletAddressesHandler } from './api/wallet/getAddresses'
import { GetStatusHandler } from './api/getStatus'
import { GetAllWalletsHandler } from './api/wallet/getAllWallets'
import { GetTransactionsHandler } from './api/wallet/getTransactions'
import { GetIdentitiesHandler } from './api/wallet/getIdentities'
import {GetIdentityBalance} from "./api/wallet/getIdentityBalance";
import {GetIdentityNonce} from "./api/wallet/getIdentityNonce";
import {GetTransactionByHashHandler} from "./api/wallet/getTransactionByHash";
import {GetBlockByHash} from "./api/wallet/getBlockByHash";
import {GetBalance} from "./api/wallet/getBalance";
import {DeleteWalletHandler} from "./api/wallet/deleteWallet";
import {GetWalletBalance} from "./api/wallet/getWalletBalance";
import {SetAddressLabel} from "./api/wallet/setAddressLabel";
import {SelectWallet} from "./api/wallet/selectWallet";
import {VerifyWalletPasswordHandler} from "./api/wallet/verifyWalletPassword";
import {SetLanguageHandler} from "./api/setLanguage";
import {Preferences} from "./preferences";
import {GetPreferencesHandler} from "./api/getPreferences";
import {ResetPreferencesHandler} from "./api/resetPreferences";
import {SetFiatCurrencyHandler} from "./api/setFiatCurrency";

export class WalletBackend {
  private walletService?: WalletService
  private addressesService?: AddressesService
  private applicationService?: ApplicationService
  private preferences?: Preferences

  private initHandlers(): void {
    if (!this.walletService || !this.addressesService || !this.applicationService || !this.preferences) {
      throw new Error('Services not initialized. Call start() first.')
    }

    ipcMain.handle('createWallet', new CreateWalletHandler(this.walletService).handle)
    ipcMain.handle('deleteWallet', new DeleteWalletHandler(this.walletService).handle)
    ipcMain.handle('getAllWallets', new GetAllWalletsHandler(this.walletService).handle)
    ipcMain.handle('selectWallet', new SelectWallet(this.walletService).handle)
    ipcMain.handle('getWalletBalance', new GetWalletBalance(this.walletService).handle)
    ipcMain.handle('getAddresses', new GetWalletAddressesHandler(this.walletService, this.addressesService).handle)
    ipcMain.handle('getStatus', new GetStatusHandler(this.walletService, this.applicationService).handle)
    ipcMain.handle('getTransactions', new GetTransactionsHandler(this.walletService).handle)
    ipcMain.handle('getBalance', new GetBalance(this.walletService).handle)
    ipcMain.handle("getTransactionByHash", new GetTransactionByHashHandler(this.walletService).handle)
    ipcMain.handle('getIdentities', new GetIdentitiesHandler(this.walletService).handle)
    ipcMain.handle('getIdentityBalance', new GetIdentityBalance(this.walletService).handle)
    ipcMain.handle('getIdentityNonce', new GetIdentityNonce(this.walletService).handle)
    ipcMain.handle('getBlockByHash', new GetBlockByHash(this.walletService).handle)
    ipcMain.handle('setAddressLabel', new SetAddressLabel(this.walletService).handle)
    ipcMain.handle('verifyWalletPassword', new VerifyWalletPasswordHandler(this.walletService).handle)
    ipcMain.handle('getPreferences', new GetPreferencesHandler(this.preferences).handle)
    ipcMain.handle('setLanguage', new SetLanguageHandler(this.preferences).handle)
    ipcMain.handle('setFiatCurrency', new SetFiatCurrencyHandler(this.preferences).handle)
    ipcMain.handle('resetPreferences', new ResetPreferencesHandler(this.preferences).handle)
  }

  async start(): Promise<void> {
    ensureHomeFolder()

    // calibrate only on start and then using until wallet running
    const calibratedIterations = calibratePBKDF2Iterations(PBKDF2_TARGET_MS)

    const preferences = await Preferences.init(path.join(os.homedir(), HomeFolderName, PreferencesFilename))

    const knex = getKnex(path.join(os.homedir(), HomeFolderName, StorageFilename))

    await migrateKnex(knex, path.join(process.cwd(), 'src/main/migrations'))

    const walletDAO = new WalletDAO(knex)
    const addressDAO = new AddressDAO(knex)
    const identityDAO = new IdentityDAO(knex)
    const dashPlatformSDK = new DashPlatformSDK({ network: 'testnet'})


    this.applicationService = new ApplicationService()
    this.walletService = new WalletService(walletDAO, addressDAO, identityDAO, dashPlatformSDK, calibratedIterations)
    this.addressesService = new AddressesService(walletDAO, addressDAO)
    this.preferences = preferences

    this.initHandlers()

    this.applicationService.markReady()
  }
}
