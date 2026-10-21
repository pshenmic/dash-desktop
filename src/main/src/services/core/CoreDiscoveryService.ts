import {base58} from '@scure/base'
import {HDKey} from '@scure/bip32'
import {AddressDAO} from '../../database/AddressDAO'
import {DashPayContactRequestDAO} from '../../database/DashPayContactRequestDAO'
import {IdentityDAO} from '../../database/IdentityDAO'
import {TransactionDAO} from '../../database/TransactionDAO'
import {WalletDAO} from '../../database/WalletDAO'
import {WalletProvider} from '../../providers/WalletProvider'
import {WalletProviderFactory} from '../../providers/WalletProviderFactory'
import {Address} from '../../types/Address'
import {AddressUsage} from '../../types/AddressDiscovery'
import {DerivedAddress, UsageOracle, AddressWindowStore} from '../../types/AddressWindow'
import {CORE_ADDRESS_WINDOW, DASHPAY_ADDRESS_WINDOW, DASHPAY_WATCH_INDEX, DISCOVERY_INTERVAL_MS, HD_VERSIONS} from '../../constants/addresses'
import {coreAddressDeriver} from '../../utils/addressDiscovery'
import {dashPayAddressDeriver, deriveDashPayContactKey} from '../../utils/dashPayKeys'
import {AddressDeriver} from '../../types/AddressWindow'
import {DashPayDirection} from '../../types/DashPay'
import {Wallet} from '../../types/Wallet'
import {runAddressWindow} from '../../utils/addressWindow'
import {WalletSyncService} from './WalletSyncService'
import {Logger} from '../../utils/logger'

const log = new Logger('discovery')

export class CoreDiscoveryService {
  private walletDAO: WalletDAO
  private addressDAO: AddressDAO
  private identityDAO: IdentityDAO
  private dashPayContactRequestDAO: DashPayContactRequestDAO
  private transactionDAO: TransactionDAO
  private walletSyncService: WalletSyncService
  private providers: WalletProviderFactory
  private discoveryInflight = new Map<string, Promise<void>>()
  private lastXpubScanAt = new Map<string, number>()
  // Wallets whose initial scan + gap-limit discovery has converged this process.
  // Avoids re-issuing the (idempotent) latch write on every discovery tick.
  private scanCompleteLatched = new Set<string>()

  constructor(
    walletDAO: WalletDAO,
    addressDAO: AddressDAO,
    identityDAO: IdentityDAO,
    dashPayContactRequestDAO: DashPayContactRequestDAO,
    transactionDAO: TransactionDAO,
    walletSyncService: WalletSyncService,
    providers: WalletProviderFactory,
  ) {
    this.walletDAO = walletDAO
    this.addressDAO = addressDAO
    this.identityDAO = identityDAO
    this.dashPayContactRequestDAO = dashPayContactRequestDAO
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

  async ensureXpubAddressWindow(walletId: string): Promise<void> {
    const lastScan = this.lastXpubScanAt.get(walletId)
    if (lastScan != null && Date.now() - lastScan < DISCOVERY_INTERVAL_MS) return

    const existing = this.discoveryInflight.get(walletId)
    if (existing != null) {
      await existing
      const completedScan = this.lastXpubScanAt.get(walletId)
      if (completedScan != null && Date.now() - completedScan < DISCOVERY_INTERVAL_MS) return
    }

    await this.rediscoverCoreAddresses(walletId)
  }

  private async runCoreDiscovery(walletId: string): Promise<void> {
    const wallet = await this.walletDAO.getWalletById(walletId)
    if (wallet == null || wallet.coreXpub == null) return

    const network = wallet.network
    const provider = this.providers.forWallet(walletId, network)
    // Both chains read one scan: the endpoint walks the whole account, and
    // asking twice would run the gap walk twice.
    const usage = await provider.scanAddressUsage(CORE_ADDRESS_WINDOW.gapLimit)
    const scanned = Promise.resolve(usage)

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
      log.info(
        `${isChange ? 'change' : 'receiving'} — derived ${revealed.length} ` +
        `address(es) at index ${revealed[0].index}..${revealed[revealed.length - 1].index}`,
      )
    }

    added.push(...await this.discoverDashPayAddresses(wallet, provider))

    if (added.length > 0) {
      await this.walletSyncService.addWatchAddresses(walletId, added)
    } else if (this.walletSyncService.isSyncedFor(walletId) && !this.scanCompleteLatched.has(walletId)) {
      // Latching convergence lets later frontier-derived addresses skip the
      // historical rewind (see addWatchAddresses). The gate is "discovery added
      // nothing", not merely "reached the tip": gap batches still being found must
      // keep triggering the rewind that finds their history.
      //
      // The scan tip is chainTip - SCAN_TIP_DEPTH, so a used address hiding in the
      // last blocks can latch convergence and later derive an index whose deep
      // history is skipped.
      this.scanCompleteLatched.add(walletId)
      await this.transactionDAO.markInitialScanComplete(walletId).catch(err => {
        this.scanCompleteLatched.delete(walletId)
        log.error('markInitialScanComplete failed:', err)
      })
    }

    if (usage != null) this.lastXpubScanAt.set(walletId, Date.now())
  }

  // The next address of a contact's chain, marked used before any transaction
  // is built so it is never handed out twice, as key-wallet's pool does.
  async nextDashPayPayAddress(wallet: Wallet, identifier: string, contactId: string, contactXpub: string): Promise<string> {
    const unused = async () => (await this.addressDAO.getDashPayAddresses(wallet.walletId, identifier, contactId, 'external'))
      .find(address => !address.isUsed)
    let next = await unused()
    if (next == null) {
      const deriver = dashPayAddressDeriver(HDKey.fromExtendedKey(contactXpub), wallet.network, contactId, identifier)
      await this.dashPayWindow(wallet, this.providers.forWallet(wallet.walletId, wallet.network), identifier, contactId, 'external', deriver)
      next = await unused()
    }
    if (next == null) throw new Error('No unused address to pay this contact on')
    await this.addressDAO.markDashPayAddressesUsed(wallet.walletId, identifier, contactId, 'external', [next.index])
    return next.address
  }

  // Both DIP-15 chains of each friendship: ours for every request we sent, and
  // theirs once their key is stored. Only ours is watched; theirs holds what we paid.
  private async discoverDashPayAddresses(wallet: Wallet, provider: WalletProvider): Promise<Address[]> {
    const ours = new Set((await this.identityDAO.getIdentitiesByWalletId(wallet.walletId)).map(identity => identity.identifier))
    const requests = await this.dashPayContactRequestDAO.getContactRequests(wallet.walletId)

    const added: Address[] = []
    if (wallet.dashPayXpub != null) {
      const account = HDKey.fromExtendedKey(wallet.dashPayXpub, HD_VERSIONS[wallet.network])
      const sent = new Map(requests.filter(request => ours.has(request.ownerId)).map(request => [`${request.ownerId}:${request.toUserId}`, request]))
      for (const {ownerId: identifier, toUserId: contactId} of sent.values()) {
        const key = deriveDashPayContactKey(account, base58.decode(identifier), base58.decode(contactId))
        const revealed = await this.dashPayWindow(wallet, provider, identifier, contactId, 'receiving',
          dashPayAddressDeriver(key, wallet.network, identifier, contactId))
        added.push(...revealed.map(derived => ({...this.coreAddressRow(wallet.walletId, false, derived), index: DASHPAY_WATCH_INDEX})))
      }
    }
    const received = new Map(requests.filter(request => ours.has(request.toUserId) && request.contactXpub != null)
      .map(request => [`${request.toUserId}:${request.ownerId}`, request]))
    for (const {toUserId: identifier, ownerId: contactId, contactXpub} of received.values()) {
      await this.dashPayWindow(wallet, provider, identifier, contactId, 'external',
        dashPayAddressDeriver(HDKey.fromExtendedKey(contactXpub!), wallet.network, contactId, identifier))
    }
    return added
  }

  private async dashPayWindow(
    wallet: Wallet,
    provider: WalletProvider,
    identifier: string,
    contactId: string,
    direction: DashPayDirection,
    deriver: AddressDeriver,
  ): Promise<DerivedAddress[]> {
    const {walletId} = wallet
    const revealed = await runAddressWindow(deriver, this.coreOracle(provider, Promise.resolve(null), false), {
      known: async () => (await this.addressDAO.getDashPayAddresses(walletId, identifier, contactId, direction))
        .map(({index, isUsed}) => ({index, isUsed})),
      reveal: addresses => this.addressDAO.insertDashPayAddresses(addresses.map(({index, address}) => ({
        walletId, identifier, contactId, direction, index, address, isUsed: false,
      }))),
      markUsed: indexes => this.addressDAO.markDashPayAddressesUsed(walletId, identifier, contactId, direction, indexes),
    }, DASHPAY_ADDRESS_WINDOW)
    if (revealed.length > 0) log.info(`dashpay ${direction} ${identifier} <-> ${contactId}: derived ${revealed.length} address(es)`)
    return revealed
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
