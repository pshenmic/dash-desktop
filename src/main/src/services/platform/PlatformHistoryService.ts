import {PLATFORM_HISTORY_SEND_REFRESH_DELAYS_MS} from '../../constants/platformExplorer'
import {LOCAL_SOURCE_PREFIX} from '../../constants/database'
import {IdentityDAO} from '../../database/IdentityDAO'
import {PlatformAddressDAO} from '../../database/PlatformAddressDAO'
import {PlatformTransactionDAO} from '../../database/PlatformTransactionDAO'
import {ShieldedNoteDAO} from '../../database/ShieldedNoteDAO'
import {ShieldedPoolDAO} from '../../database/ShieldedPoolDAO'
import {WalletDAO} from '../../database/WalletDAO'
import {PlatformExplorerProvider} from '../../providers/PlatformExplorerProvider'
import {Logger} from '../../utils/logger'
import {requireWallet} from '../../utils/requireWallet'
import {ShieldedSend} from '../../types/PlatformTransaction'
import {transitionToHeader} from '../../utils/platformExplorerTransactions'
import {
  noteKey,
  noteSideTransaction,
  shieldedActions,
  shieldedSides,
} from '../../utils/shieldedTransitionNotes'

const log = new Logger('platform')

// Addresses and identities are indexed separately, so one transition that moved
// credits between them is listed by both and folded on the way out.
export class PlatformHistoryService {
  private walletDAO: WalletDAO
  private identityDAO: IdentityDAO
  private platformAddressDAO: PlatformAddressDAO
  private platformTransactionDAO: PlatformTransactionDAO
  private shieldedNoteDAO: ShieldedNoteDAO
  private shieldedPoolDAO: ShieldedPoolDAO
  // Only as far as this session knows: a restart forgets it.
  private failedRefreshes = new Set<string>()
  private walks = new Map<string, Promise<void>>()
  // A transition whose notes this wallet cannot read yet has nothing to fill
  // in, and asking the explorer again every minute would be for nothing. Keyed
  // on how many notes were decrypted at the time, so a sync reopens it.
  private shieldedRead = new Map<string, number>()

  constructor(
    walletDAO: WalletDAO,
    identityDAO: IdentityDAO,
    platformAddressDAO: PlatformAddressDAO,
    platformTransactionDAO: PlatformTransactionDAO,
    shieldedNoteDAO: ShieldedNoteDAO,
    shieldedPoolDAO: ShieldedPoolDAO,
  ) {
    this.walletDAO = walletDAO
    this.identityDAO = identityDAO
    this.platformAddressDAO = platformAddressDAO
    this.platformTransactionDAO = platformTransactionDAO
    this.shieldedNoteDAO = shieldedNoteDAO
    this.shieldedPoolDAO = shieldedPoolDAO
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

    const notes = await this.shieldedNoteDAO.getOwnedNotes(walletId)
    const noteAddresses = [...new Set(notes.map(note => note.address))]

    // Before the walk: the rows of an address this wallet dropped would
    // otherwise fold in alongside the ones that replaced them. A shielded
    // address is a source like any other and its rows stay.
    await this.platformTransactionDAO.deleteRetiredSources(walletId, [
      ...addresses.map(row => row.address),
      ...identities.map(identity => identity.identifier),
      ...noteAddresses,
    ])

    // One source failing must not discard the pages the others already wrote.
    const results = await Promise.allSettled([
      ...addresses.map(row => explorer.addressTransactions(row.address, walletId)),
      ...identities.map(identity => explorer.identityTransactions(identity.identifier, walletId)),
    ])

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        log.warn(`${walletId}: platform history stops at the page cap, older transitions are not stored`)
      }
    }

    for (const result of results) {
      if (result.status === 'rejected') throw result.reason
    }

    // A walk can turn up a transition whose notes were decrypted long ago. One
    // query when there is nothing to fill, and no request without a gap.
    await this.readShieldedSides(walletId).catch(err =>
      log.warn(`${walletId}: reading the shielded side failed:`, err))
  }

  // One row per end it moved, each under the source whose own row replaces it,
  // so a send between two of ours nets to the fee rather than reading as a loss.
  async recordShieldedSend(walletId: string, send: ShieldedSend): Promise<void> {
    const header = {hash: send.hash, type: send.type, date: new Date(),
      blockHeight: null, status: null, gasCredits: 0n}

    for (const side of send.sides) {
      const row = noteSideTransaction(walletId, header, side.address, side.credits)
      // An end of ours brings a side of its own; anyone else's has only this.
      const paid = send.paid != null && side.credits < 0n ? {recipient: [send.paid]} : {}
      await this.platformTransactionDAO.upsertTransactions(
        `${LOCAL_SOURCE_PREFIX}${side.address}`, [{...row, ...paid}])
    }
  }

  // A shield tells the address it spent from only about the surplus it sent
  // back, and a shielded transfer tells it nothing: what moved is in a note.
  // Stored like a walk's row, so the pool folds in as one more side.
  async readShieldedSides(walletId: string): Promise<void> {
    const notes = await this.shieldedNoteDAO.getOwnedNotes(walletId)
    if (notes.length === 0) return

    const wallet = await requireWallet(this.walletDAO, walletId)
    const explorer = new PlatformExplorerProvider(wallet.network, this.platformTransactionDAO)

    const pool = await this.shieldedPoolDAO.getEncryptedNotes(wallet.network, notes.map(note => note.index))
    const byIndex = new Map(notes.map(note => [note.index, note]))
    const byCmx = new Map(pool.flatMap(record => {
      const note = byIndex.get(record.index)
      return note == null ? [] : [[noteKey(record.cmx), note] as const]
    }))
    const byNullifier = new Map(notes.flatMap(note =>
      note.nullifier == null ? [] : [[noteKey(note.nullifier), note] as const]))

    const addresses = [...new Set(notes.map(note => note.address))]
    const hashes = await this.platformTransactionDAO.getShieldedGaps(wallet.walletId, addresses)

    for (const hash of hashes) {
      if (this.shieldedRead.get(hash) === notes.length) continue

      const transition = await explorer.transition(hash)
      // Only once it answered: a transition the index has yet to reach is the
      // one this wallet has most reason to ask about again.
      this.shieldedRead.set(hash, notes.length)
      if (transition.data == null) continue

      const header = transitionToHeader(transition)
      const sides = shieldedSides(shieldedActions(transition.data), byCmx, byNullifier)
      for (const [address, net] of sides) {
        await this.platformTransactionDAO.upsertTransactions(
          address, [noteSideTransaction(wallet.walletId, header, address, net)])
      }
    }
  }
}
