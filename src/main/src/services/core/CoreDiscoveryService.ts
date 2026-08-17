import {KeyPairController} from 'dash-platform-sdk/src/keyPair/index.js'
import {AddressDAO} from '../../database/AddressDAO'
import {TransactionDAO} from '../../database/TransactionDAO'
import {WalletDAO} from '../../database/WalletDAO'
import {WalletProvider} from '../../providers/WalletProvider'
import {WalletProviderFactory} from '../../providers/WalletProviderFactory'
import {Address} from '../../types/Address'
import {AddressUsage} from '../../types/AddressDiscovery'
import {Network} from '../../types/Network'
import {ADDRESS_GAP_BATCH, ADDRESS_LOOKAHEAD, COIN_TYPE, MAX_DISCOVERY_ROUNDS} from '../../constants'
import {deriveCorePublicKey, planGapExtension} from '../../utils/addressDiscovery'
import {WalletSyncService} from './WalletSyncService'

export class CoreDiscoveryService {
  private walletDAO: WalletDAO
  private addressDAO: AddressDAO
  private transactionDAO: TransactionDAO
  private walletSyncService: WalletSyncService
  private providers: WalletProviderFactory
  // Derivation only — a DashPlatformSDK would build a gRPC pool and fetch the
  // evonode list to do local maths.
  private keyPair = new KeyPairController()
  private discoveryInflight = new Map<string, Promise<void>>()
  // Wallets whose initial scan + gap-limit discovery has converged this process.
  // Avoids re-issuing the (idempotent) latch write on every discovery tick.
  private scanCompleteLatched = new Set<string>()

  constructor(
    walletDAO: WalletDAO,
    addressDAO: AddressDAO,
    transactionDAO: TransactionDAO,
    walletSyncService: WalletSyncService,
    providers: WalletProviderFactory,
  ) {
    this.walletDAO = walletDAO
    this.addressDAO = addressDAO
    this.transactionDAO = transactionDAO
    this.walletSyncService = walletSyncService
    this.providers = providers
  }

  discoverCoreAddresses(walletId: string): Promise<void> {
    const existing = this.discoveryInflight.get(walletId)
    if (existing) return existing
    const run = this.runCoreDiscovery(walletId).finally(() => this.discoveryInflight.delete(walletId))
    this.discoveryInflight.set(walletId, run)
    return run
  }

  // A run in flight picked its provider when it started, so it is still asking
  // the old connection mode which addresses are used. Queue a fresh pass behind
  // it instead of joining it.
  rediscoverCoreAddresses(walletId: string): Promise<void> {
    const existing = this.discoveryInflight.get(walletId)
    if (existing == null) return this.discoverCoreAddresses(walletId)
    return existing.catch(() => {}).then(() => this.discoverCoreAddresses(walletId))
  }

  private async runCoreDiscovery(walletId: string): Promise<void> {
    const wallet = await this.walletDAO.getWalletById(walletId)
    if (wallet == null || wallet.coreXpub == null) return

    const coreXpub = wallet.coreXpub
    const network = wallet.network
    const provider = this.providers.forWallet(walletId, network)

    const scan = await provider.scanAddressUsage(ADDRESS_LOOKAHEAD)
    const added = scan != null
      ? await this.applyAddressScan(walletId, coreXpub, network, scan)
      : await this.widenAddressWindow(walletId, coreXpub, network, provider)

    if (added.length > 0) {
      await this.walletSyncService.addWatchAddresses(walletId, added)
      return
    }

    // Latching convergence lets later frontier-derived addresses skip the
    // historical rewind (see addWatchAddresses). The gate is "discovery added
    // nothing", not merely "reached the tip": gap batches still being found must
    // keep triggering the rewind that finds their history.
    //
    // The scan tip is chainTip - SCAN_TIP_DEPTH, so a used address hiding in the
    // last blocks can latch convergence and later derive an index whose deep
    // history is skipped.
    if (this.walletSyncService.isSyncedFor(walletId) && !this.scanCompleteLatched.has(walletId)) {
      this.scanCompleteLatched.add(walletId)
      await this.transactionDAO.markInitialScanComplete(walletId).catch(err => {
        this.scanCompleteLatched.delete(walletId)
        console.error('[discovery] markInitialScanComplete failed:', err)
      })
    }
  }

  private coreAddressRows(
    walletId: string,
    coreXpub: string,
    network: Network,
    isChange: boolean,
    indexes: number[],
  ): Address[] {
    const coinType = COIN_TYPE[network]
    return indexes.map(index => ({
      walletId,
      accountId: 0,
      address: this.keyPair.p2pkhAddress(deriveCorePublicKey(coreXpub, network, isChange, index), network),
      derivationPath: `m/44'/${coinType}'/0'/${isChange ? 1 : 0}/${index}`,
      index,
      isChange,
      isUsed: false,
      label: null,
    }))
  }

  // The scan already walked the gap to the frontier, so one pass replaces the
  // widening rounds.
  private async applyAddressScan(
    walletId: string,
    coreXpub: string,
    network: Network,
    scan: AddressUsage[],
  ): Promise<Address[]> {
    const grouped = await this.addressDAO.getAddressesByWalletId(walletId)
    const added: Address[] = []

    for (const isChange of [false, true]) {
      const chain = isChange ? grouped.change : grouped.receiving
      const scanned = scan.filter(entry => entry.isChange === isChange)
      const known = new Map(chain.map(a => [a.index, a]))

      const usedIndexes = scanned.filter(entry => entry.isUsed).map(entry => entry.index)
      const lastUsed = usedIndexes.reduce((max, index) => Math.max(max, index), -1)
      const highestKnown = chain.reduce((max, a) => Math.max(max, a.index), -1)

      // The window must stay contiguous from zero: a used index the scan found
      // past the old frontier is otherwise never derived.
      const frontier = Math.max(highestKnown, lastUsed + ADDRESS_LOOKAHEAD)
      const missing: number[] = []
      for (let index = 0; index <= frontier; index++) {
        if (!known.has(index)) missing.push(index)
      }

      const rows = missing.length > 0
        ? this.coreAddressRows(walletId, coreXpub, network, isChange, missing)
        : []
      if (rows.length > 0) {
        await this.addressDAO.insertAddresses(rows)
        added.push(...rows)
        console.log(
          `[discovery] ${isChange ? 'change' : 'receiving'} scan — derived ` +
          `${rows.length} address(es) at index ${missing[0]}..${missing[missing.length - 1]}`,
        )
      }

      const addressAt = new Map([...known].map(([index, a]) => [index, a.address]))
      for (const row of rows) addressAt.set(row.index, row.address)

      const newlyUsed = usedIndexes
        .filter(index => known.get(index)?.isUsed !== true)
        .map(index => addressAt.get(index))
        .filter((address): address is string => address != null)
      if (newlyUsed.length > 0) {
        await this.addressDAO.markAddressesUsed(walletId, newlyUsed)
      }
    }

    return added
  }

  private async widenAddressWindow(
    walletId: string,
    coreXpub: string,
    network: Network,
    provider: WalletProvider,
  ): Promise<Address[]> {
    const added: Address[] = []

    for (const isChange of [false, true]) {
      for (let round = 0; round < MAX_DISCOVERY_ROUNDS; round++) {
        const grouped = await this.addressDAO.getAddressesByWalletId(walletId)
        const chain = isChange ? grouped.change : grouped.receiving
        const unused = chain.filter(a => !a.isUsed)
        const newlyUsed = unused.length > 0 ? await provider.getUsedAddresses(unused.map(a => a.address)) : []
        if (newlyUsed.length > 0) {
          await this.addressDAO.markAddressesUsed(walletId, newlyUsed)
        }

        const usedSet = new Set(newlyUsed)
        const entries = chain.map(a => ({index: a.index, isUsed: a.isUsed || usedSet.has(a.address)}))
        const indexes = planGapExtension(entries, ADDRESS_LOOKAHEAD, ADDRESS_GAP_BATCH)
        if (indexes.length === 0) break

        const rows = this.coreAddressRows(walletId, coreXpub, network, isChange, indexes)
        await this.addressDAO.insertAddresses(rows)
        added.push(...rows)
        console.log(
          `[discovery] ${isChange ? 'change' : 'receiving'} gap exhausted — derived ` +
          `${rows.length} address(es) at index ${indexes[0]}..${indexes[indexes.length - 1]}`,
        )
      }
    }

    return added
  }
}
