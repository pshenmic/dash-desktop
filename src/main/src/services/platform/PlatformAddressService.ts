import {PlatformAddressWASM} from 'pshenmic-dpp'
import {WalletDAO} from '../../database/WalletDAO'
import {PlatformAddressDAO} from '../../database/PlatformAddressDAO'
import {PlatformWorkerService} from './PlatformWorkerService'
import {Network} from '../../types/Network'
import {Wallet} from '../../types/Wallet'
import {PlatformAddressEntry, PlatformAddressRow} from '../../types/PlatformAddress'
import {PlatformSourceCandidate} from '../../types/PlatformTransfer'
import {DerivedAddress, UsageOracle, AddressWindowStore} from '../../types/AddressWindow'
import {AddressInfo} from '../../../platform/types/messages'
import {PLATFORM_ADDRESS_WINDOW} from '../../constants/addresses'
import {platformAddressDeriver} from '../../utils/platformAddress'
import {runAddressWindow} from '../../utils/addressWindow'
import {requireWallet} from '../../utils/requireWallet'

// The wallet's DIP-17 transparent addresses: the account xpub, the gap window
// over it, and the balance and nonce that decide what each one can fund.
//
// Reads only. Everything that spends what these hold is PlatformTransferService.
export class PlatformAddressService {
  private walletDAO: WalletDAO
  private platformAddressDAO: PlatformAddressDAO
  private platform: PlatformWorkerService
  private windowInflight = new Map<string, Promise<void>>()

  constructor(walletDAO: WalletDAO, platformAddressDAO: PlatformAddressDAO, platform: PlatformWorkerService) {
    this.walletDAO = walletDAO
    this.platformAddressDAO = platformAddressDAO
    this.platform = platform
  }

  async getPlatformAddresses(walletId: string): Promise<PlatformAddressEntry[]> {
    const wallet = await requireWallet(this.walletDAO, walletId)
    const candidates = await this.loadCandidates(wallet)

    return candidates.map(candidate => ({
      platformAddress: candidate.platformAddress,
      balanceCredits: candidate.balanceCredits,
      nonce: candidate.nonce,
    }))
  }

  // Every platform address this wallet owns, with the balance and nonce that
  // decide whether it can fund anything.
  async loadCandidates(wallet: Wallet): Promise<PlatformSourceCandidate[]> {
    if (wallet.platformXpub == null) return []

    // Fetched infos are shared with the window walk, so an address is looked up
    // once per call however many rounds the walk takes.
    const infos = new Map<string, AddressInfo>()
    await this.extendWindowOnce(wallet, infos)

    const rows = await this.platformAddressDAO.getAddresses(wallet.walletId)
    await this.fetchInfos(wallet.network, rows.map(row => row.address), infos)

    return rows.map(row => ({
      platformAddress: row.address,
      addressBytes: PlatformAddressWASM.fromBech32m(row.address).bytes(),
      index: row.index,
      balanceCredits: infos.get(row.address)?.balance ?? 0n,
      nonce: infos.get(row.address)?.nonce ?? 0,
    }))
  }

  // Reveals one more address than the window found on its own. Public
  // derivation, so no password: the account xpub is all it takes.
  async addPlatformAddress(walletId: string): Promise<PlatformAddressEntry[]> {
    const wallet = await requireWallet(this.walletDAO, walletId)
    if (wallet.platformXpub == null) {
      throw new Error('Platform addresses are not derived yet')
    }

    const rows = await this.platformAddressDAO.getAddresses(walletId)
    const next = rows.reduce((max, row) => Math.max(max, row.index), -1) + 1
    const derived = platformAddressDeriver(wallet.platformXpub, wallet.network).derive(next)
    await this.platformAddressDAO.insertAddresses([this.addressRow(walletId, derived)])

    return this.getPlatformAddresses(walletId)
  }

  // A walk is several sequential worker round trips, on a channel the renderer
  // polls — the same guard as CoreDiscoveryService.discoveryInflight.
  private extendWindowOnce(wallet: Wallet, infos: Map<string, AddressInfo>): Promise<void> {
    const existing = this.windowInflight.get(wallet.walletId)
    if (existing) return existing

    const run = this.extendWindow(wallet, infos)
      .finally(() => this.windowInflight.delete(wallet.walletId))
    this.windowInflight.set(wallet.walletId, run)
    return run
  }

  private async extendWindow(wallet: Wallet, infos: Map<string, AddressInfo>): Promise<void> {
    const xpub = wallet.platformXpub
    if (xpub == null) return

    await this.seedLegacyWindow(wallet, xpub)
    await runAddressWindow(
      platformAddressDeriver(xpub, wallet.network),
      this.platformOracle(wallet.network, infos),
      this.platformStore(wallet.walletId),
      PLATFORM_ADDRESS_WINDOW,
    )
  }

  // Addresses were a count on the wallet before they were rows, and the count is
  // the only record of one the user revealed by hand. Read once, when the table
  // for this wallet is still empty.
  private async seedLegacyWindow(wallet: Wallet, xpub: string): Promise<void> {
    const rows = await this.platformAddressDAO.getAddresses(wallet.walletId)
    if (rows.length > 0) return

    const revealed = await this.walletDAO.getPlatformAddressCount(wallet.walletId)
    const count = Math.max(PLATFORM_ADDRESS_WINDOW.gapLimit, revealed)
    const deriver = platformAddressDeriver(xpub, wallet.network)
    await this.platformAddressDAO.insertAddresses(
      Array.from({length: count}, (_, index) => this.addressRow(wallet.walletId, deriver.derive(index))),
    )
  }

  // Platform keeps no per-address history, so "used" is read off current state.
  // The nonce is monotonic, which is what makes an emptied address still count.
  private platformOracle(network: Network, infos: Map<string, AddressInfo>): UsageOracle {
    return {
      scan: async () => null,
      probe: async addresses => {
        await this.fetchInfos(network, addresses.map(entry => entry.address), infos)
        return addresses.map(entry => {
          const info = infos.get(entry.address)
          return {index: entry.index, isUsed: info != null && (info.balance > 0n || info.nonce > 0)}
        })
      },
    }
  }

  private platformStore(walletId: string): AddressWindowStore {
    return {
      known: async () => {
        const rows = await this.platformAddressDAO.getAddresses(walletId)
        return rows.map(row => ({index: row.index, isUsed: row.isUsed}))
      },
      reveal: addresses => this.platformAddressDAO.insertAddresses(
        addresses.map(derived => this.addressRow(walletId, derived)),
      ),
      markUsed: indexes => this.platformAddressDAO.markAddressesUsed(walletId, indexes),
    }
  }

  // An address the worker omits is unused, so every address asked for is
  // recorded — otherwise the ones that came back empty look unasked and the
  // next caller in the same pass fetches them all over again.
  private async fetchInfos(network: Network, addresses: string[], infos: Map<string, AddressInfo>): Promise<void> {
    const missing = addresses.filter(address => !infos.has(address))
    if (missing.length === 0) return

    const {infos: fetched} = await this.platform.request('addressInfos', network, {addresses: missing})
    for (const address of missing) infos.set(address, {address, balance: 0n, nonce: 0})
    for (const info of fetched) infos.set(info.address, info)
  }

  private addressRow(walletId: string, derived: DerivedAddress): PlatformAddressRow {
    return {
      walletId,
      index: derived.index,
      address: derived.address,
      derivationPath: derived.derivationPath,
      isUsed: false,
    }
  }
}
