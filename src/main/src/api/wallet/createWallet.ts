import { IpcMainInvokeEvent } from 'electron/utility'
import { Network } from '../../types'
import { WalletService } from '../../services/WalletService'
import { AddressDAO } from '../../database/AddressDAO'
import { SpvService } from '../../services/SpvService'

export class CreateWalletHandler {
  private walletService: WalletService
  private addressDAO: AddressDAO
  private spvService: SpvService

  constructor(walletService: WalletService, addressDAO: AddressDAO, spvService: SpvService) {
    this.walletService = walletService
    this.addressDAO = addressDAO
    this.spvService = spvService
  }

  handle = async (_event: IpcMainInvokeEvent, seedphrase: string, network: Network, password: string): Promise<string> => {
    const walletId = await this.walletService.createWallet(seedphrase, network, password)
    // Push the new wallet's addresses into the running SPV scan if one is up
    // for this network. addWatchAddresses is a no-op otherwise.
    const grouped = await this.addressDAO.getAddressesByWalletId(walletId)
    const addressList = [...grouped.receiving, ...grouped.change].map(a => a.address)
    this.spvService.addWatchAddresses(network, addressList)
    return walletId
  }
}