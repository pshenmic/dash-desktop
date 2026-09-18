import {PLATFORM_EXPLORER_ADDRESS_SOURCE} from '../../constants/platformExplorer'
import {IdentityDAO} from '../../database/IdentityDAO'
import {PlatformAddressDAO} from '../../database/PlatformAddressDAO'
import {PlatformTransactionDAO} from '../../database/PlatformTransactionDAO'
import {WalletDAO} from '../../database/WalletDAO'
import {PlatformExplorerProvider} from '../../providers/PlatformExplorerProvider'
import {PlatformTransaction} from '../../types/PlatformTransaction'
import {Logger} from '../../utils/logger'
import {mergePlatformTransactions} from '../../utils/platformExplorerTransactions'
import {requireWallet} from '../../utils/requireWallet'

const log = new Logger('platform')

// L2 history. A wallet owns credits through two kinds of subject and the
// explorer indexes them separately, so the two are read apart and folded: one
// transition that moved credits between them is listed by both.
//
// Stored rows are what the read answers with; the explorer is asked only for
// what is missing. Each walk runs newest-first and stops where our rows begin,
// so once the first one has run a refresh costs a page per source.
export class PlatformHistoryService {
  private walletDAO: WalletDAO
  private identityDAO: IdentityDAO
  private platformAddressDAO: PlatformAddressDAO
  private platformTransactionDAO: PlatformTransactionDAO

  constructor(
    walletDAO: WalletDAO,
    identityDAO: IdentityDAO,
    platformAddressDAO: PlatformAddressDAO,
    platformTransactionDAO: PlatformTransactionDAO,
  ) {
    this.walletDAO = walletDAO
    this.identityDAO = identityDAO
    this.platformAddressDAO = platformAddressDAO
    this.platformTransactionDAO = platformTransactionDAO
  }

  async getPlatformTransactions(walletId: string): Promise<PlatformTransaction[]> {
    let failure: unknown = null
    try {
      await this.refresh(walletId)
    } catch (err) {
      failure = err
    }

    const stored = await this.platformTransactionDAO.getTransactions(walletId)

    // With nothing stored the list is empty because the read failed, which is
    // what the caller reports. With rows in hand it is not.
    if (failure != null) {
      if (stored.length === 0) throw failure
      log.warn(`${walletId}: platform explorer unreachable, serving stored history:`, failure)
    }

    return mergePlatformTransactions(stored)
  }

  private async refresh(walletId: string): Promise<void> {
    const wallet = await requireWallet(this.walletDAO, walletId)
    const explorer = new PlatformExplorerProvider(wallet.network)

    const [addresses, identities] = await Promise.all([
      this.platformAddressDAO.getAddresses(walletId),
      this.identityDAO.getIdentitiesByWalletId(walletId),
    ])

    await Promise.all([
      this.ingest(walletId, PLATFORM_EXPLORER_ADDRESS_SOURCE, known =>
        explorer.addressTransactions(addresses.map(row => row.address), walletId, known)),
      ...identities.map(identity => this.ingest(walletId, identity.identifier, known =>
        explorer.identityTransactions(identity.identifier, walletId, known))),
    ])
  }

  // Folded before the write so the chunks an address walk is split into leave
  // one row per transition rather than one each.
  private async ingest(
    walletId: string,
    source: string,
    walk: (known: Set<string>) => Promise<PlatformTransaction[]>,
  ): Promise<void> {
    const found = await walk(await this.platformTransactionDAO.getKnownHashes(walletId, source))
    if (found.length === 0) return

    await this.platformTransactionDAO.upsertTransactions(source, mergePlatformTransactions(found))
  }
}
