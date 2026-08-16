import {randomBytes} from 'crypto'
import {KeyPairController} from 'dash-platform-sdk/src/keyPair/index.js'
import {PlatformWorkerService} from './PlatformWorkerService'
import {WalletDAO} from '../database/WalletDAO'
import {AddressDAO} from '../database/AddressDAO'
import {IdentityDAO} from '../database/IdentityDAO'
import {TransactionDAO} from '../database/TransactionDAO'
import {ApplicationService} from './ApplicationService'
import {WalletSyncService} from './WalletSyncService'
import {WalletProvider} from '../providers/WalletProvider'
import {DashscanWalletProvider} from '../providers/DashscanWalletProvider'
import {P2PWalletProvider} from '../providers/P2PWalletProvider'
import {Network} from '../types/Network'
import {Address} from '../types/Address'
import {GroupedAddresses} from '../types/GroupedAddresses'
import {IdentityInfo} from '../types/Identity'
import {Wallet} from '../types/Wallet'
import {Transaction as SDKTransaction} from "dash-core-sdk";
import {QueryStatus} from "../types/QueryStatus";
import {WalletBalance} from "../types/WalletBalance";
import {Transaction} from "../types/Transaction";
import {SendResult} from "../types/SendResult";
import {TxLockStatus} from "../types/TxLockStatus";
import {selectCoins} from '../utils/coinSelection'
import {CoreTransactionService} from './CoreTransactionService'
import {decryptMnemonic, encryptMnemonic} from "../utils";
import {withUnlockedWallet} from "../utils/walletSeed";
import {
  ADDRESS_LOOKAHEAD,
  COIN_TYPE,
  IDENTITY_LOOKAHEAD,
  IDENTITY_SCAN_LIMIT,
  MAX_DISCOVERY_ROUNDS,
  PLATFORM_ACCOUNT,
} from '../constants'
import {identityPath} from '../utils/identityKeys'
import {coreAccountPath, deriveCorePublicKey, planGapExtension} from "../utils/addressDiscovery";
import {AddressUsage} from '../types/AddressDiscovery'
import {SelectableUtxo} from '../types/CoinSelection'
import {TransferInput} from '../types/CoreTransaction'


export class WalletService {
  private walletDAO: WalletDAO
  private addressDAO: AddressDAO
  private identityDAO: IdentityDAO
  private transactionDAO: TransactionDAO
  private applicationService: ApplicationService
  private walletSyncService: WalletSyncService
  private platform: PlatformWorkerService
  private pbkdf2Iterations: number
  // Derivation only — a DashPlatformSDK would build a gRPC pool and fetch the
  // evonode list to do local maths.
  private keyPair = new KeyPairController()
  private coreTransactionService: CoreTransactionService
  private discoveryInflight = new Map<string, Promise<void>>()
  // Wallets whose initial scan + gap-limit discovery has converged this process.
  // Avoids re-issuing the (idempotent) latch write on every discovery tick.
  private scanCompleteLatched = new Set<string>()

  constructor(
    walletDAO: WalletDAO,
    addressDAO: AddressDAO,
    identityDAO: IdentityDAO,
    transactionDAO: TransactionDAO,
    applicationService: ApplicationService,
    walletSyncService: WalletSyncService,
    platform: PlatformWorkerService,
    pbkdf2Iterations: number,
  ) {
    this.pbkdf2Iterations = pbkdf2Iterations
    this.walletDAO = walletDAO
    this.addressDAO = addressDAO
    this.identityDAO = identityDAO
    this.transactionDAO = transactionDAO
    this.applicationService = applicationService
    this.walletSyncService = walletSyncService
    this.platform = platform
    this.coreTransactionService = new CoreTransactionService()
  }

  // Picks the WalletProvider for a wallet at call time, honouring the user's
  // connection-type preference. Reads only — broadcast goes over our own peer
  // pool in both modes, so the preference does not reach it.
  getProvider(walletId: string, network: Network): WalletProvider {
    if (this.applicationService.preferences.general.connectionType === 'p2p') {
      return new P2PWalletProvider(this.transactionDAO, walletId, this.walletSyncService, this.addressDAO)
    }
    return new DashscanWalletProvider(network, walletId, this.addressDAO, this.walletDAO)
  }

  async createWallet(seedphrase: string, network: Network, password: string): Promise<string> {
    const wordCount = seedphrase.trim().split(/\s+/).length
    if (![12, 15, 18, 21, 24].includes(wordCount)) {
      throw new Error('Seedphrase must be 12, 15, 18, 21, or 24 words')
    }

    if (network !== 'mainnet' && network !== 'testnet') {
      throw new Error('Invalid network ("mainnet", "testnet")')
    }

    const walletId = randomBytes(4).toString('hex')
    const encryptedMnemonic = encryptMnemonic(seedphrase, password, this.pbkdf2Iterations)

    await this.walletDAO.saveWallet(encryptedMnemonic, walletId, network, null)

    const seed = this.keyPair.mnemonicToSeed(seedphrase)
    const hdKey = this.keyPair.seedToHdKey(seed, network)
    const coinType = COIN_TYPE[network]
    const accountId = 0

    const platformXpub = await this.keyPair.derivePlatformAccountXpub(seed, network, PLATFORM_ACCOUNT)
    await this.walletDAO.setPlatformXpub(walletId, platformXpub)

    const coreAccountNode = await this.keyPair.derivePath(hdKey, coreAccountPath(coinType, accountId))
    await this.walletDAO.setCoreXpub(walletId, coreAccountNode.publicExtendedKey)

    const addresses: Address[] = []

    for (let i = 0; i < ADDRESS_LOOKAHEAD; i++) {
      const key = await this.keyPair.derivePath(hdKey, `m/44'/${coinType}'/${accountId}'/0/${i}`)
      if (!key.publicKey) throw new Error(`Failed to derive public key at index ${i}`)
      const address = this.keyPair.p2pkhAddress(key.publicKey, network)
      addresses.push({
        walletId,
        accountId,
        address,
        derivationPath: `m/44'/${coinType}'/${accountId}'/0/${i}`,
        index: i,
        isChange: false,
        isUsed: false,
        label: null
      })
    }

    for (let i = 0; i < ADDRESS_LOOKAHEAD; i++) {
      const key = await this.keyPair.derivePath(hdKey, `m/44'/${coinType}'/${accountId}'/1/${i}`)
      if (!key.publicKey) throw new Error(`Failed to derive public key at index ${i}`)
      const address = this.keyPair.p2pkhAddress(key.publicKey, network)
      addresses.push({
        walletId,
        accountId,
        address,
        derivationPath: `m/44'/${coinType}'/${accountId}'/1/${i}`,
        index: i,
        isChange: true,
        isUsed: false,
        label: null
      })
    }

    await this.addressDAO.insertAddresses(addresses)

    try {
      await this.discoverCoreAddresses(walletId)
    } catch (e) {
      console.error('Core address discovery after wallet creation failed:', e)
    }

    // The wallet and addresses are already persisted, so a scan that cannot
    // reach the worker must not abandon them — a retry would create a second
    // wallet for the same seed.
    try {
      const {identities} = await this.platform.request('identityScan', network, {
        seed,
        startIndex: 0,
        gapLimit: IDENTITY_LOOKAHEAD,
        scanLimit: IDENTITY_SCAN_LIMIT,
      })

      if (identities.length > 0) {
        await this.identityDAO.insertIdentities(identities.map(entry => ({
          walletId,
          identityIndex: entry.index,
          derivationPath: identityPath(network, entry.index),
          identifier: entry.identifier,
        })))
      }
    } catch (e) {
      console.error('Identity discovery after wallet creation failed:', e)
    }

    return walletId
  }

  async deleteWallet(walletId: string): Promise<QueryStatus> {
    return this.walletDAO.deleteWallet(walletId)
  }

  async getAllWallets(): Promise<Wallet[]> {
    return this.walletDAO.getAllWallets()
  }

  async getWalletById(walletId: string): Promise<Wallet | null> {
    return this.walletDAO.getWalletById(walletId)
  }

  async getSelectedWallet(): Promise<Wallet | null> {
    return this.walletDAO.getSelectedWallet()
  }

  async setSelectedWallet(walletId: string): Promise<QueryStatus> {
    const result = await this.walletDAO.setSelectedWallet(walletId)
    if (result.success) {
      const wallet = await this.walletDAO.getWalletById(walletId)
      if (wallet != null) {
        await this.walletSyncService.startLockListen(wallet.network, walletId)
          .catch(err => console.error('[locks] failed to start lock listener:', err))
      }
    }
    return result
  }

  async exportMnemonic(walletId: string, password: string): Promise<string> {
    const wallet = await this.walletDAO.getWalletById(walletId)
    if (wallet == null) {
      throw new Error('Wallet not found')
    }

    const isValid = await this.verifyWalletPassword(walletId, password)
    if (!isValid) {
      throw new Error('Invalid password')
    }

    return decryptMnemonic(wallet.encryptedMnemonic, password)
  }

  async verifyWalletPassword(walletId: string, password: string): Promise<boolean> {
    const wallet = await this.walletDAO.getWalletById(walletId)

    if (wallet == null) {
      throw new Error('No selected wallet found')
    }

    let decryptedMnemonic: string

    try {
       decryptedMnemonic = decryptMnemonic(wallet.encryptedMnemonic, password)
    } catch {
      return false
    }

    const isValid = await this.mnemonicMatchesWallet(walletId, wallet.network, decryptedMnemonic)

    if (isValid && (wallet.platformXpub == null || wallet.coreXpub == null)) {
      const seed = this.keyPair.mnemonicToSeed(decryptedMnemonic)
      const hdKey = this.keyPair.seedToHdKey(seed, wallet.network)

      if (wallet.platformXpub == null) {
        const platformXpub = await this.keyPair.derivePlatformAccountXpub(seed, wallet.network, PLATFORM_ACCOUNT)
        await this.walletDAO.setPlatformXpub(walletId, platformXpub)
      }

      if (wallet.coreXpub == null) {
        const accountNode = await this.keyPair.derivePath(hdKey, coreAccountPath(COIN_TYPE[wallet.network], 0))
        await this.walletDAO.setCoreXpub(walletId, accountNode.publicExtendedKey)
      }
    }

    return isValid
  }

  async verifyWalletMnemonic(walletId: string, mnemonic: string): Promise<boolean> {
    const wallet = await this.walletDAO.getWalletById(walletId)
    if (wallet == null) {
      throw new Error('Wallet not found')
    }

    return this.mnemonicMatchesWallet(walletId, wallet.network, mnemonic)
  }

  async resetWalletPassword(walletId: string, mnemonic: string, newPassword: string): Promise<boolean> {
    const matches = await this.verifyWalletMnemonic(walletId, mnemonic)
    if (!matches) {
      return false
    }

    const encryptedMnemonic = encryptMnemonic(mnemonic.trim(), newPassword, this.pbkdf2Iterations)
    await this.walletDAO.updateEncryptedMnemonic(walletId, encryptedMnemonic)

    return true
  }

  private async mnemonicMatchesWallet(walletId: string, network: Network, mnemonic: string): Promise<boolean> {
    const groupedAddresses = await this.addressDAO.getAddressesByWalletId(walletId)
    const [referenceWalletAddress] = [...groupedAddresses.change, ...groupedAddresses.receiving]

    if (referenceWalletAddress == null) {
      return false
    }

    try {
      const seed = this.keyPair.mnemonicToSeed(mnemonic.trim())
      const hdKey = this.keyPair.seedToHdKey(seed, network)
      const coinType = COIN_TYPE[network]

      const key = await this.keyPair.derivePath(hdKey, `m/44'/${coinType}'/0'/1/${referenceWalletAddress.index}`)
      if (!key.publicKey) {
        return false
      }

      return this.keyPair.p2pkhAddress(key.publicKey, network) === referenceWalletAddress.address
    } catch {
      return false
    }
  }

  async setAddressLabel(walletId: string, address: string, label: string): Promise<QueryStatus> {
    return this.addressDAO.setAddressLabel(walletId, address, label)
  }

  async setWalletLabel(walletId: string, label: string | null): Promise<QueryStatus> {
    return this.walletDAO.updateLabel(walletId, label)
  }

  async addAddress(walletId: string, password: string, isChange: boolean): Promise<string> {
    return withUnlockedWallet(this.walletDAO, walletId, password, ({wallet, seed}) =>
      this.deriveNextAddress(walletId, wallet, seed, isChange))
  }

  private async deriveNextAddress(walletId: string, wallet: Wallet, seed: Uint8Array, isChange: boolean): Promise<string> {
    const hdKey = this.keyPair.seedToHdKey(seed, wallet.network)
    const coinType = COIN_TYPE[wallet.network]
    const accountId = 0

    const grouped = await this.addressDAO.getAddressesByWalletId(walletId)
    const chain = isChange ? grouped.change : grouped.receiving
    const index = chain.reduce((max, a) => Math.max(max, a.index), -1) + 1

    const derivationPath = `m/44'/${coinType}'/${accountId}'/${isChange ? 1 : 0}/${index}`
    const key = await this.keyPair.derivePath(hdKey, derivationPath)
    if (!key.publicKey) throw new Error(`Failed to derive public key at index ${index}`)
    const address = this.keyPair.p2pkhAddress(key.publicKey, wallet.network)

    const row: Address = {
      walletId,
      accountId,
      address,
      derivationPath,
      index,
      isChange,
      isUsed: false,
      label: null
    }
    await this.addressDAO.insertAddresses([row])

    await this.walletSyncService.addWatchAddresses(walletId, [row], {forwardOnly: true})

    return address
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
    const provider = this.getProvider(walletId, network)

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
    // nothing", not merely "reached the tip": while gap batches are still being
    // found this stays unlatched, so they keep triggering the rewind that finds
    // their history.
    //
    // Accepted residual: the scan tip is chainTip - SCAN_TIP_DEPTH, so
    // convergence can be declared while a used address hides in the last couple
    // of blocks. It could then surface later, extend the frontier, and derive an
    // index whose deep history is skipped. Revisit if we track a birthday or
    // scan the tip window before latching.
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
        const indexes = planGapExtension(entries, ADDRESS_LOOKAHEAD)
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

  async getReceiveAddress(walletId: string): Promise<string> {
    const wallet = await this.walletDAO.getWalletById(walletId)
    if (wallet == null) throw new Error('Wallet not found')

    const provider = this.getProvider(wallet.walletId, wallet.network)
    return provider.nextUnusedAddress()
  }

  async getAddressesByWalletId(walletId: string): Promise<GroupedAddresses> {
    const wallet = await this.walletDAO.getWalletById(walletId)

    if (wallet == null) {
      throw new Error('Wallet not found')
    }

    const addresses = await this.addressDAO.getAddressesByWalletId(walletId)

    const provider = this.getProvider(wallet.walletId, wallet.network)

    const all = [...addresses.receiving, ...addresses.change]
    const infos = await provider.getAddressInfos(all.map(a => a.address))
    const byAddress = new Map(infos.map(info => [info.address, info]))

    // TODO: add real usd balance
    const withBalance = (address: Address): Address => ({
      ...address,
      balance: byAddress.get(address.address)?.balance ?? 0n,
      txCount: byAddress.get(address.address)?.txCount ?? 0,
      usdBalance: '0.0'
    })

    return {
      receiving: addresses.receiving.map(withBalance),
      change: addresses.change.map(withBalance)
    }
  }

  async getTransactions(walletId: string): Promise<Transaction[]> {
    const wallet = await this.walletDAO.getWalletById(walletId)

    if (wallet == null) {
      throw new Error('Wallet not found')
    }

    const provider = this.getProvider(wallet.walletId, wallet.network)

    return provider.getWalletTransactions()
  }

  async getTransactionByHash(hash: string, network: Network): Promise<Transaction> {
    if (network !== 'mainnet' && network !== 'testnet') {
      throw new Error('Invalid network ("mainnet", "testnet")')
    }

    const wallet = await this.walletDAO.getSelectedWallet()

    if (wallet == null) {
      throw new Error('No selected wallet found')
    }

    const provider = this.getProvider(wallet.walletId, network)

    return provider.getTransactionByHash(hash)
  }

  async getWalletBalance(walletId: string): Promise<WalletBalance> {
    const wallet = await this.walletDAO.getWalletById(walletId)

    if (wallet == null) {
      throw new Error('Wallet not found')
    }

    const identities = await this.identityDAO.getIdentitiesByWalletId(walletId)

    const provider = this.getProvider(wallet.walletId, wallet.network)

    const addressesBalance = await provider.getWalletBalance()

    const {infos} = await this.platform.request('identityInfos', wallet.network, {
      identifiers: identities.map(identity => identity.identifier),
      skipDPNS: true,
    })
    const identitiesBalance = infos.reduce((acc, info) => acc + info.balance, 0n)

    return {
      dash: {
        amount: addressesBalance,
        usdAmount: '0.0'
      },
      credits: {
        amount: identitiesBalance,
        usdAmount: '0.0'
      }
    }
  }

  async getBalance(address: string | string[], network: Network): Promise<bigint> {
    if (network !== 'mainnet' && network !== 'testnet') {
      throw new Error('Invalid network ("mainnet", "testnet")')
    }

    const wallet = await this.walletDAO.getSelectedWallet()
    if (wallet == null) {
      throw new Error('No selected wallet found')
    }
    const provider = this.getProvider(wallet.walletId, network)

    return await provider.getBalance(address)
  }

  async sendTransaction(
    walletId: string,
    toAddress: string,
    amountDuffs: bigint,
    password: string,
    fromAddress?: string,
  ): Promise<SendResult> {
    if (amountDuffs <= 0n) {
      throw new Error('Send amount must be greater than zero')
    }

    const {tx, inputTotal, changeAddress} = await withUnlockedWallet(this.walletDAO, walletId, password, async ({wallet, seed}) => {
      const network = wallet.network
      const recipientType = this.coreTransactionService.classifyRecipientAddress(toAddress, network)
      const {transferInputs, inputTotal, changeAddress} = await this.gatherTransferInputs(walletId, network, amountDuffs, fromAddress)

      const tx = await this.coreTransactionService.buildSignedTransfer({
        inputs: transferInputs,
        toAddress,
        recipientType,
        amount: amountDuffs,
        changeAddress,
        inputTotal,
        seed,
        network,
      })
      return {tx, inputTotal, changeAddress}
    })

    const broadcast = await this.walletSyncService.broadcastTransaction(tx.hex())

    const outputTotal = tx.outputs.reduce((sum, output) => sum + output.satoshis, 0n)
    const actualFee = inputTotal - outputTotal
    const hasChange = tx.outputs.length > 1

    return {
      txid: broadcast.txid,
      amount: amountDuffs,
      fee: actualFee,
      toAddress,
      changeAddress: hasChange ? changeAddress : null,
      peersAcked: broadcast.peersDelivered.length,
    }
  }

  async getTxLockStatus(walletId: string, txid: string): Promise<TxLockStatus> {
    const wallet = await this.walletDAO.getWalletById(walletId)
    if (wallet == null) {
      throw new Error('Wallet not found')
    }
    const provider = this.getProvider(wallet.walletId, wallet.network)
    const status = await provider.getTxLockStatus(txid)
    if (status.instantLocked) return status
    // The isdlock arrives on our own pool in both modes, but rpc mode keeps no
    // local row for markInstantLocked to have written it to.
    return {...status, instantLocked: this.walletSyncService.hasInstantLock(txid)}
  }

  // Builds an InstantAssetLockProof for shield / asset-lock funding without
  // depending on DAPI islock delivery. Null if none arrives within timeoutMs.
  waitForInstantLock(txid: string, timeoutMs: number): Promise<string | null> {
    return this.walletSyncService.waitForInstantLock(txid, timeoutMs)
  }

  // The clsig counterpart. Null if the pool reports no height that high within
  // timeoutMs.
  waitForChainLock(network: Network, minHeight: number, timeoutMs: number): Promise<number | null> {
    return this.walletSyncService.waitForChainLock(network, minHeight, timeoutMs)
  }

  chainlockedHeight(network: Network): number {
    return this.walletSyncService.chainlockedHeight(network)
  }

  async getUsedAddresses(walletId: string, addresses: string[]): Promise<string[]> {
    const wallet = await this.walletDAO.getWalletById(walletId)
    if (wallet == null) throw new Error('Wallet not found')
    return this.getProvider(walletId, wallet.network).getUsedAddresses(addresses)
  }

  private async gatherTransferInputs(walletId: string, network: Network, amountDuffs: bigint, fromAddress?: string): Promise<{
    transferInputs: TransferInput[]
    inputTotal: bigint
    changeAddress: string
    grouped: GroupedAddresses
  }> {
    const grouped = await this.addressDAO.getAddressesByWalletId(walletId)
    const allAddresses = [...grouped.receiving, ...grouped.change]
    const pathByAddress = new Map(allAddresses.map(a => [a.address, a.derivationPath]))

    const provider = this.getProvider(walletId, network)
    await provider.ensureReady()

    // The provider answers for the whole wallet, including indexes discovery
    // has not derived — those have no derivation path and cannot be signed.
    const ownedUtxos = (await provider.getWalletUtxos())
      .filter(utxo => pathByAddress.has(utxo.address))
      .filter(utxo => fromAddress == null || utxo.address === fromAddress)

    if (ownedUtxos.length === 0) {
      throw new Error('No spendable funds in this wallet')
    }

    const selectable: SelectableUtxo[] = ownedUtxos.map(utxo => ({
      txid: utxo.txId,
      vout: utxo.vOut,
      satoshis: utxo.satoshis,
      address: utxo.address,
    }))

    const selection = selectCoins(selectable, amountDuffs)

    const utxoByKey = new Map(ownedUtxos.map(u => [`${u.txId}:${u.vOut}`, u]))

    const changeAddress = this.pickChangeAddress(grouped)

    const transferInputs: TransferInput[] = selection.inputs.map(input => {
      const owned = utxoByKey.get(`${input.txid}:${input.vout}`)
      if (!owned) throw new Error('Selected UTXO no longer available')

      const derivationPath = pathByAddress.get(input.address)
      if (derivationPath == null) throw new Error(`No derivation path for address ${input.address}`)

      return {
        txId: owned.txId,
        vOut: owned.vOut,
        script: owned.script,
        derivationPath,
        address: input.address,
      }
    })

    return {transferInputs, inputTotal: selection.inputTotal, changeAddress, grouped}
  }

  async buildAndBroadcastAssetLock(walletId: string, amountDuffs: bigint, seed: Uint8Array, credit?: {address: string; derivationPath: string}): Promise<{
    tx: SDKTransaction
    txid: string
    creditAddress: string
    creditDerivationPath: string
    inputAddresses: string[]
  }> {
    if (amountDuffs <= 0n) {
      throw new Error('Amount must be greater than zero')
    }

    const wallet = await this.walletDAO.getWalletById(walletId)
    if (wallet == null) {
      throw new Error('Wallet not found')
    }
    const network = wallet.network

    const {transferInputs, inputTotal, changeAddress, grouped} = await this.gatherTransferInputs(walletId, network, amountDuffs)

    const creditTarget = credit ?? this.pickCreditChangeAddress(grouped, changeAddress)

    const tx = await this.coreTransactionService.buildSignedAssetLock({
      inputs: transferInputs,
      amountDuffs,
      creditAddress: creditTarget.address,
      changeAddress,
      inputTotal,
      seed,
      network,
    })

    let txid: string
    try {
      txid = (await this.walletSyncService.broadcastTransaction(tx.hex())).txid
    } catch (error) {
      console.error('Asset lock broadcast failed, rawtx:', tx.hex())
      throw error
    }

    return {
      tx,
      txid,
      creditAddress: creditTarget.address,
      creditDerivationPath: creditTarget.derivationPath,
      inputAddresses: transferInputs.map(input => input.address),
    }
  }

  private pickCreditChangeAddress(grouped: GroupedAddresses, changeAddress: string): {address: string; derivationPath: string} {
    const credit = grouped.change.find(a => !a.isUsed && a.address !== changeAddress)
      ?? grouped.change.find(a => !a.isUsed)
      ?? grouped.change[grouped.change.length - 1]
    if (credit == null) {
      throw new Error('Wallet has no change address for the asset lock credit output')
    }
    return {address: credit.address, derivationPath: credit.derivationPath}
  }

  // Falls back to the first change address, then to a receiving one, so change
  // never leaves the wallet.
  private pickChangeAddress(grouped: GroupedAddresses): string {
    const unusedChange = grouped.change.find(a => !a.isUsed)
    if (unusedChange) return unusedChange.address
    if (grouped.change.length > 0) return grouped.change[grouped.change.length - 1].address
    if (grouped.receiving.length > 0) return grouped.receiving[0].address
    throw new Error('Wallet has no change address')
  }

  async getIdentities(walletId: string): Promise<IdentityInfo[]> {
    const wallet = await this.walletDAO.getWalletById(walletId)

    if (!wallet) {
      throw new Error('Wallet not found')
    }

    const stored = await this.identityDAO.getIdentitiesByWalletId(walletId)
    const {infos} = await this.platform.request('identityInfos', wallet.network, {
      identifiers: stored.map(entry => entry.identifier),
      skipDPNS: false,
    })
    const byIdentifier = new Map(infos.map(info => [info.identifier, info]))

    // An identity the worker could not resolve is not registered yet — skipped,
    // as before.
    return stored.flatMap(entry => {
      const info = byIdentifier.get(entry.identifier)
      if (info == null) return []
      // TODO: Implement read usd amount
      return [{
        identityIndex: entry.identityIndex,
        identifier: info.identifier,
        alias: info.alias,
        balance: {
          amount: info.balance,
          usdAmount: '0.0'
        },
        derivationPath: entry.derivationPath,
        assetLockTxid: entry.assetLockTxid ?? null
      }]
    })
  }

  async getIdentityBalance(identifier: string): Promise<bigint> {
    const wallet = await this.walletDAO.getSelectedWallet()
    if (wallet == null) {
      throw new Error('No selected wallet found')
    }
    const {credits} = await this.platform.request('identityBalance', wallet.network, {identifier})
    return credits
  }

  async getIdentityNonce(identifier: string): Promise<bigint> {
    const wallet = await this.walletDAO.getSelectedWallet()
    if (wallet == null) {
      throw new Error('No selected wallet found')
    }
    const {nonce} = await this.platform.request('identityNonce', wallet.network, {identifier})
    return nonce
  }
}

