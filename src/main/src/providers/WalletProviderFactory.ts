import {AddressDAO} from '../database/AddressDAO'
import {TransactionDAO} from '../database/TransactionDAO'
import {WalletDAO} from '../database/WalletDAO'
import {ApplicationService} from '../services/app/ApplicationService'
import {WalletSyncService} from '../services/core/WalletSyncService'
import {Network} from '../types/Network'
import {DashscanWalletProvider} from './DashscanWalletProvider'
import {P2PWalletProvider} from './P2PWalletProvider'
import {WalletProvider} from './WalletProvider'

// Abstract factory
// needed for move out getProvider() from WalletService
export class WalletProviderFactory {
  private walletDAO: WalletDAO
  private addressDAO: AddressDAO
  private transactionDAO: TransactionDAO
  private applicationService: ApplicationService
  private walletSyncService: WalletSyncService

  constructor(
    walletDAO: WalletDAO,
    addressDAO: AddressDAO,
    transactionDAO: TransactionDAO,
    applicationService: ApplicationService,
    walletSyncService: WalletSyncService,
  ) {
    this.walletDAO = walletDAO
    this.addressDAO = addressDAO
    this.transactionDAO = transactionDAO
    this.applicationService = applicationService
    this.walletSyncService = walletSyncService
  }

  forWallet(walletId: string, network: Network): WalletProvider {
    if (this.applicationService.preferences.general.connectionType === 'p2p') {
      return new P2PWalletProvider(this.transactionDAO, walletId, this.walletSyncService, this.addressDAO)
    }
    return new DashscanWalletProvider(network, walletId, this.addressDAO, this.walletDAO)
  }
}
