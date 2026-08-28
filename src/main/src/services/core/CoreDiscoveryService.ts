import {AddressDAO} from '../../database/AddressDAO'
import {TransactionDAO} from '../../database/TransactionDAO'
import {WalletDAO} from '../../database/WalletDAO'
import {WalletProvider} from '../../providers/WalletProvider'
import {WalletProviderFactory} from '../../providers/WalletProviderFactory'
import {Address} from '../../types/Address'
import {AddressUsage} from '../../types/AddressDiscovery'
import {DerivedAddress, UsageOracle, AddressWindowStore} from '../../types/AddressWindow'
import {CORE_ADDRESS_WINDOW} from '../../constants/addresses'
import {coreAddressDeriver} from '../../utils/addressDiscovery'
import {runAddressWindow} from '../../utils/addressWindow'
import {WalletSyncService} from './WalletSyncService'

export class CoreDiscoveryService {
  private walletDAO: WalletDAO
  private addressDAO: AddressDAO
  private transactionDAO: TransactionDAO
  private walletSyncService: WalletSyncService
  private providers: WalletProviderFactory
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

    const network = wallet.network
    const provider = this.providers.forWallet(walletId, network)
    // Both chains read one scan: the endpoint walks the whole account, and
    // asking twice would run the gap walk twice.
    const scanned = provider.scanAddressUsage(CORE_ADDRESS_WINDOW.gapLimit)

    const added: Address[] = []
    for (const isChange of [false, true]) {
      const revealed = await runAddressWindow(
        coreAddressDeriver(wallet.coreXpub, network, isChange),
        this.coreOracle(provider, scanned, isChange),
        this.coreStore(walletId, isChange),
        CORE_ADDRESS_WINDOW,
      )
      if (revealed.length === 0) continue

      added.push(...revealed.map(derived => this.coreAddressRow(walletId, isChange, derived)))
      console.log(
        `[discovery] ${isChange ? 'change' : 'receiving'} — derived ${revealed.length} ` +
        `address(es) at index ${revealed[0].index}..${revealed[revealed.length - 1].index}`,
      )
    }

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

  private coreOracle(
    provider: WalletProvider,
    scanned: Promise<AddressUsage[] | null>,
    isChange: boolean,
  ): UsageOracle {
    return {
      scan: async () => {
        const usage = await scanned
        return usage == null
          ? null
          : usage.filter(entry => entry.isChange === isChange)
            .map(({index, isUsed}) => ({index, isUsed}))
      },
      probe: async addresses => {
        const used = new Set(await provider.getUsedAddresses(addresses.map(entry => entry.address)))
        return addresses.map(entry => ({index: entry.index, isUsed: used.has(entry.address)}))
      },
    }
  }

  private coreStore(walletId: string, isChange: boolean): AddressWindowStore {
    return {
      known: async () => {
        const grouped = await this.addressDAO.getAddressesByWalletId(walletId)
        const chain = isChange ? grouped.change : grouped.receiving
        return chain.map(address => ({index: address.index, isUsed: address.isUsed}))
      },
      reveal: addresses => this.addressDAO.insertAddresses(
        addresses.map(derived => this.coreAddressRow(walletId, isChange, derived)),
      ),
      markUsed: indexes => this.addressDAO.markAddressesUsed(walletId, isChange, indexes),
    }
  }

  private coreAddressRow(walletId: string, isChange: boolean, derived: DerivedAddress): Address {
    return {
      walletId,
      accountId: 0,
      address: derived.address,
      derivationPath: derived.derivationPath,
      index: derived.index,
      isChange,
      isUsed: false,
      label: null,
    }
  }
}
