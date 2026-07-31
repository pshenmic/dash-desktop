import { IpcMainInvokeEvent } from 'electron/utility'
import { Network } from '../../types'
import { WalletService } from '../../services/WalletService'
import { AddressDAO } from '../../database/AddressDAO'
import { WalletSyncService } from '../../services/WalletSyncService'
import { ShieldedService } from '../../services/ShieldedService'

export class CreateWalletHandler {
  private walletService: WalletService
  private addressDAO: AddressDAO
  private walletSyncService: WalletSyncService
  private shieldedService: ShieldedService

  constructor(walletService: WalletService, addressDAO: AddressDAO, walletSyncService: WalletSyncService, shieldedService: ShieldedService) {
    this.walletService = walletService
    this.addressDAO = addressDAO
    this.walletSyncService = walletSyncService
    this.shieldedService = shieldedService
  }

  handle = async (_event: IpcMainInvokeEvent, seedphrase: string, network: Network, password: string): Promise<string> => {
    const walletId = await this.walletService.createWallet(seedphrase, network, password)
    // Derives and persists the shielded address list for the new wallet.
    await this.shieldedService.getAddresses(walletId, password)
    // Push the new wallet's addresses into a running wallet sync only if it's
    // already syncing THIS wallet (per-wallet sync model). 
    const grouped = await this.addressDAO.getAddressesByWalletId(walletId)
    const addressList = [...grouped.receiving, ...grouped.change].map(a => a.address)
    await this.walletSyncService.addWatchAddresses(walletId, addressList)
    return walletId
  }
}