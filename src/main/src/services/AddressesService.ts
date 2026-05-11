import {AddressDAO} from '../database/AddressDAO'
import {GroupedAddresses} from "../types/GroupedAddresses";
import {WalletDAO} from "../database/WalletDAO";
import {WalletProviderFactory} from "../providers/WalletProviderFactory";

export class AddressesService {
  private addressDAO: AddressDAO
  private walletDAO: WalletDAO
  private providerFactory: WalletProviderFactory

  constructor(walletDAO: WalletDAO, addressDAO: AddressDAO, providerFactory: WalletProviderFactory) {
    this.addressDAO = addressDAO
    this.walletDAO = walletDAO
    this.providerFactory = providerFactory
  }

  async getAddressesByWalletId(walletId: string): Promise<GroupedAddresses> {
    const wallet = await this.walletDAO.getWalletById(walletId)

    if (wallet == null) {
      throw new Error('Wallet not found')
    }

    const addresses = await this.addressDAO.getAddressesByWalletId(walletId)

    const provider = this.providerFactory.for(wallet.walletId, wallet.network)

    // TODO: add real usd balance
    const receivingAddressesWithBalance = await Promise.all(addresses.receiving.map(async (address) => ({
        ...address,
        balance: await provider.getBalance(address.address),
        usdBalance: '0.0'
      })
    ))

    const changeAddressesWithBalance = await Promise.all(addresses.change.map(async (address) => ({
        ...address,
        balance: await provider.getBalance(address.address),
        usdBalance: '0.0'
      })
    ))

    return {
      receiving: receivingAddressesWithBalance,
      change: changeAddressesWithBalance
    }
  }
}
