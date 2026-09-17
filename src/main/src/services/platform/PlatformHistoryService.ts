import {IdentityDAO} from '../../database/IdentityDAO'
import {PlatformAddressDAO} from '../../database/PlatformAddressDAO'
import {WalletDAO} from '../../database/WalletDAO'
import {PlatformExplorerProvider} from '../../providers/PlatformExplorerProvider'
import {PlatformTransaction} from '../../types/PlatformTransaction'
import {mergePlatformTransactions} from '../../utils/platformExplorerTransactions'
import {requireWallet} from '../../utils/requireWallet'

// L2 history. A wallet owns credits through two kinds of subject and the
// explorer indexes them separately, so the two are read apart and folded: one
// transition that moved credits between them is listed by both.
export class PlatformHistoryService {
  private walletDAO: WalletDAO
  private identityDAO: IdentityDAO
  private platformAddressDAO: PlatformAddressDAO

  constructor(walletDAO: WalletDAO, identityDAO: IdentityDAO, platformAddressDAO: PlatformAddressDAO) {
    this.walletDAO = walletDAO
    this.identityDAO = identityDAO
    this.platformAddressDAO = platformAddressDAO
  }

  async getPlatformTransactions(walletId: string): Promise<PlatformTransaction[]> {
    const wallet = await requireWallet(this.walletDAO, walletId)
    const explorer = new PlatformExplorerProvider(wallet.network)

    const [addresses, identities] = await Promise.all([
      this.platformAddressDAO.getAddresses(walletId),
      this.identityDAO.getIdentitiesByWalletId(walletId),
    ])

    const [fromAddresses, fromIdentities] = await Promise.all([
      explorer.addressTransactions(addresses.map(row => row.address), walletId),
      explorer.identityTransactions(identities.map(row => row.identifier), walletId),
    ])

    return mergePlatformTransactions([...fromAddresses, ...fromIdentities])
  }
}
