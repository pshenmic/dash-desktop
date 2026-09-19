import {PLATFORM_HISTORY_SEND_REFRESH_DELAYS_MS} from '../../constants/platformExplorer'
import {IdentityDAO} from '../../database/IdentityDAO'
import {PlatformAddressDAO} from '../../database/PlatformAddressDAO'
import {PlatformTransactionDAO} from '../../database/PlatformTransactionDAO'
import {WalletDAO} from '../../database/WalletDAO'
import {PlatformExplorerProvider} from '../../providers/PlatformExplorerProvider'
import {Logger} from '../../utils/logger'
import {requireWallet} from '../../utils/requireWallet'

const log = new Logger('platform')

// Addresses and identities are indexed separately, so one transition that moved
// credits between them is listed by both and folded on the way out.
export class PlatformHistoryService {
  private walletDAO: WalletDAO
  private identityDAO: IdentityDAO
  private platformAddressDAO: PlatformAddressDAO
  private platformTransactionDAO: PlatformTransactionDAO
  // Only as far as this session knows: a restart forgets it.
  private failedRefreshes = new Set<string>()
  private walks = new Map<string, Promise<void>>()

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

  lastRefreshFailed(walletId: string): boolean {
    return this.failedRefreshes.has(walletId)
  }

  // Fire-and-forget: a send must not carry the explorer's latency, and must not
  // fail because the index is behind it.
  refreshAfterSend(walletId: string): void {
    void (async () => {
      for (const delay of PLATFORM_HISTORY_SEND_REFRESH_DELAYS_MS) {
        await new Promise(resolve => setTimeout(resolve, delay))
        await this.refresh(walletId).catch(err =>
          log.error(`${walletId}: platform history refresh after a send failed:`, err))
      }
    })()
  }

  async refresh(walletId: string): Promise<void> {
    // A send during the periodic refresh, or two sends in a row, would otherwise
    // ask the explorer for the same pages twice over.
    const walking = this.walks.get(walletId)
    if (walking != null) return walking

    const walk = this.walkSources(walletId)
    this.walks.set(walletId, walk)
    try {
      await walk
      this.failedRefreshes.delete(walletId)
    } catch (err) {
      this.failedRefreshes.add(walletId)
      throw err
    } finally {
      this.walks.delete(walletId)
    }
  }

  private async walkSources(walletId: string): Promise<void> {
    const [addresses, identities] = await Promise.all([
      this.platformAddressDAO.getAddresses(walletId),
      this.identityDAO.getIdentitiesByWalletId(walletId),
    ])

    // Asking anyway would hand the explorer an address set for no answer.
    if (addresses.length === 0 && identities.length === 0) return

    const wallet = await requireWallet(this.walletDAO, walletId)
    const explorer = new PlatformExplorerProvider(wallet.network, this.platformTransactionDAO)

    // Before the walk: a retired chunk's rows would otherwise fold in alongside
    // the rows replacing them.
    const addressList = addresses.map(row => row.address)
    await this.platformTransactionDAO.deleteRetiredSources(walletId, [
      ...explorer.addressChunks(addressList).map(entry => entry.source),
      ...identities.map(identity => identity.identifier),
    ])

    const addressWalk = addresses.length === 0
      ? Promise.resolve(false)
      : explorer.addressTransactions(addressList, walletId)

    // One source failing must not discard the pages the others already wrote.
    const [addressResult, ...identityResults] = await Promise.allSettled([
      addressWalk,
      ...identities.map(identity => explorer.identityTransactions(identity.identifier, walletId)),
    ])

    for (const result of [addressResult, ...identityResults]) {
      if (result.status === 'fulfilled' && result.value) {
        log.warn(`${walletId}: platform history stops at the page cap, older transitions are not stored`)
      }
    }

    for (const result of [addressResult, ...identityResults]) {
      if (result.status === 'rejected') throw result.reason
    }
  }
}
