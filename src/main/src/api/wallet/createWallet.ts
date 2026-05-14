import { IpcMainInvokeEvent } from 'electron/utility'
import { Network } from '../../types'
import { WalletService } from '../../services/WalletService'
import { AddressDAO } from '../../database/AddressDAO'
import { WalletSyncService } from '../../services/WalletSyncService'

export class CreateWalletHandler {
  private walletService: WalletService
  private addressDAO: AddressDAO
  private walletSyncService: WalletSyncService

  constructor(walletService: WalletService, addressDAO: AddressDAO, walletSyncService: WalletSyncService) {
    this.walletService = walletService
    this.addressDAO = addressDAO
    this.walletSyncService = walletSyncService
  }

  handle = async (_event: IpcMainInvokeEvent, seedphrase: string, network: Network, password: string): Promise<string> => {
    const walletId = await this.walletService.createWallet(seedphrase, network, password)
    // Push the new wallet's addresses into a running wallet sync only if it's
    // already syncing THIS wallet (per-wallet sync model). The utility
    // process gates on walletId match and silently drops mismatches, so
    // calling unconditionally is safe.
    const grouped = await this.addressDAO.getAddressesByWalletId(walletId)
    const addressList = [...grouped.receiving, ...grouped.change].map(a => a.address)
    await this.walletSyncService.addWatchAddresses(walletId, addressList)
    return walletId
  }
}