import {randomBytes} from 'crypto'
import {SdkProvider} from './SdkProvider'
import {WalletDAO} from '../database/WalletDAO'
import {AddressDAO} from '../database/AddressDAO'
import {IdentityDAO} from '../database/IdentityDAO'
import {TransactionDAO} from '../database/TransactionDAO'
import {ApplicationService} from './ApplicationService'
import {WalletSyncService} from './WalletSyncService'
import {WalletProvider} from '../providers/WalletProvider'
import {InsightWalletProvider} from '../providers/InsightWalletProvider'
import {P2PWalletProvider} from '../providers/P2PWalletProvider'
import {Network} from '../types'
import {Address} from '../types/Address'
import {GroupedAddresses} from '../types/GroupedAddresses'
import {Identity, IdentityInfo} from '../types/Identity'
import {Wallet} from '../types/Wallet'
import {PrivateKeyWASM} from 'dash-platform-sdk/types.js'
import {Transaction as SDKTransaction} from "dash-core-sdk";
import {BlockJSON} from "dash-core-sdk/src/types";
import {QueryStatus} from "../types/QueryStatus";
import {WalletBalance} from "../types/WalletBalance";
import {Transaction} from "../types/Transaction";
import {SendResult} from "../types/SendResult";
import {TxLockStatus} from "../types/TxLockStatus";
import {selectCoins, SelectableUtxo} from "../utils/coinSelection";
import {dedupeTransactions} from "../utils/dedupeTransactions";
import {CoreTransactionService, TransferInput} from "./CoreTransactionService";
import {decryptMnemonic, encryptMnemonic} from "../utils";
import {coreAccountPath, deriveCorePublicKey, planGapExtension} from "../utils/addressDiscovery";
import {ShieldedService} from "./ShieldedService";

const ADDRESS_LOOKAHEAD = 20
const IDENTITY_LOOKAHEAD = 10
const MAX_DISCOVERY_ROUNDS = 10
const COIN_TYPE: Record<Network, number> = {mainnet: 5, testnet: 1}
const PLATFORM_ACCOUNT = 0

export class WalletService {
  private walletDAO: WalletDAO
  private addressDAO: AddressDAO
  private identityDAO: IdentityDAO
  private transactionDAO: TransactionDAO
  private applicationService: ApplicationService
  private walletSyncService: WalletSyncService
  private sdkProvider: SdkProvider
  private pbkdf2Iterations: number
  private coreTransactionService: CoreTransactionService
  private shieldedService: ShieldedService
  private discoveryInflight = new Map<string, Promise<void>>()

  constructor(
    walletDAO: WalletDAO,
    addressDAO: AddressDAO,
    identityDAO: IdentityDAO,
    transactionDAO: TransactionDAO,
    applicationService: ApplicationService,
    walletSyncService: WalletSyncService,
    sdkProvider: SdkProvider,
    pbkdf2Iterations: number,
    shieldedService: ShieldedService,
  ) {
    this.pbkdf2Iterations = pbkdf2Iterations
    this.walletDAO = walletDAO
    this.addressDAO = addressDAO
    this.identityDAO = identityDAO
    this.transactionDAO = transactionDAO
    this.applicationService = applicationService
    this.walletSyncService = walletSyncService
    this.sdkProvider = sdkProvider
    this.coreTransactionService = new CoreTransactionService(sdkProvider)
    this.shieldedService = shieldedService
  }

  // Picks the WalletProvider for a wallet at call time, honouring the user's
  // connection-type preference. In p2p mode broadcast is routed through
  // WalletSyncService (the p2p utility process); in rpc mode everything
  // (including broadcast) goes through Insight.
  getProvider(walletId: string, network: Network): WalletProvider {
    if (this.applicationService.preferences.general.connectionType === 'p2p') {
      return new P2PWalletProvider(this.transactionDAO, walletId, this.walletSyncService, this.addressDAO)
    }
    return new InsightWalletProvider(network, walletId, this.addressDAO)
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

    const sdk = this.sdkProvider.getPlatformSDK(network)
    const seed = sdk.keyPair.mnemonicToSeed(seedphrase)
    const hdKey = sdk.keyPair.seedToHdKey(seed, network)
    const coinType = COIN_TYPE[network]
    const accountId = 0

    const platformXpub = await sdk.keyPair.derivePlatformAccountXpub(seed, network, PLATFORM_ACCOUNT)
    await this.walletDAO.setPlatformXpub(walletId, platformXpub)

    const coreAccountNode = await sdk.keyPair.derivePath(hdKey, coreAccountPath(coinType, accountId))
    await this.walletDAO.setCoreXpub(walletId, coreAccountNode.publicExtendedKey)

    const addresses: Address[] = []

    for (let i = 0; i < ADDRESS_LOOKAHEAD; i++) {
      const key = await sdk.keyPair.derivePath(hdKey, `m/44'/${coinType}'/${accountId}'/0/${i}`)
      if (!key.publicKey) throw new Error(`Failed to derive public key at index ${i}`)
      const address = sdk.keyPair.p2pkhAddress(key.publicKey, network)
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
      const key = await sdk.keyPair.derivePath(hdKey, `m/44'/${coinType}'/${accountId}'/1/${i}`)
      if (!key.publicKey) throw new Error(`Failed to derive public key at index ${i}`)
      const address = sdk.keyPair.p2pkhAddress(key.publicKey, network)
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

    await this.shieldedService.initAddresses(walletId, seed, network)

    const identities: Identity[] = []

    for (let i = 0, gap = 0; gap < IDENTITY_LOOKAHEAD; i++) {
      const key = sdk.keyPair.deriveIdentityPrivateKey(hdKey, i, 0, network)
      if (!key.publicKey) throw new Error(`Failed to derive identity public key at index ${i}`)

      const pkh = PrivateKeyWASM.fromBytes(key.privateKey as Uint8Array, network).getPublicKeyHash()

      let uniqueIdentity

      try {
        uniqueIdentity = await sdk.identities.getIdentityByPublicKeyHash(pkh)
      } catch {
        console.log(`Failed to fetch unique identity for publicKeyHash ${pkh}`)
      }

      let nonUniqueIdentity

      try {
        nonUniqueIdentity = await sdk.identities.getIdentityByNonUniquePublicKeyHash(pkh)
      } catch {
        console.log(`Failed to fetch non unique identity for publicKeyHash ${pkh}`)
      }

      if (nonUniqueIdentity != null || uniqueIdentity != null) {
        const identifier: string = (uniqueIdentity ?? nonUniqueIdentity).id.base58()

        identities.push({
          walletId,
          identityIndex: i,
          derivationPath: `m/9'/${coinType}'/0'/0/${i}`,
          identifier
        })
        gap = 0
      } else {
        gap++
      }
    }

    if (identities.length > 0) {
      await this.identityDAO.insertIdentities(identities)
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
    return this.walletDAO.setSelectedWallet(walletId)
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

    const groupedAddresses = await this.addressDAO.getAddressesByWalletId(walletId)
    const [referenceWalletAddress] = [...groupedAddresses.change, ...groupedAddresses.receiving]

    let decryptedMnemonic: string

    try {
       decryptedMnemonic = decryptMnemonic(wallet.encryptedMnemonic, password)
    } catch {
      return false
    }

    const keyPair = this.sdkProvider.getPlatformSDK(wallet.network).keyPair
    const seed = keyPair.mnemonicToSeed(decryptedMnemonic)
    const hdKey = keyPair.seedToHdKey(seed, wallet.network)
    const coinType = COIN_TYPE[wallet.network]

    const key = await keyPair.derivePath(hdKey, `m/44'/${coinType}'/0'/1/${referenceWalletAddress.index}`)
    if (!key.publicKey) throw new Error(`Failed to derive public key at index ${referenceWalletAddress.index}`)

    const address = keyPair.p2pkhAddress(key.publicKey, wallet.network)

    const isValid = address === referenceWalletAddress.address

    if (isValid && wallet.platformXpub == null) {
      const platformXpub = await keyPair.derivePlatformAccountXpub(seed, wallet.network, PLATFORM_ACCOUNT)
      await this.walletDAO.setPlatformXpub(walletId, platformXpub)
    }

    if (isValid && wallet.coreXpub == null) {
      const accountNode = await keyPair.derivePath(hdKey, coreAccountPath(coinType, 0))
      await this.walletDAO.setCoreXpub(walletId, accountNode.publicExtendedKey)
    }

    return isValid
  }

  async setAddressLabel(walletId: string, address: string, label: string): Promise<QueryStatus> {
    return this.addressDAO.setAddressLabel(walletId, address, label)
  }

  async setWalletLabel(walletId: string, label: string | null): Promise<QueryStatus> {
    return this.walletDAO.updateLabel(walletId, label)
  }

  async addAddress(walletId: string, password: string, isChange: boolean): Promise<string> {
    const wallet = await this.walletDAO.getWalletById(walletId)
    if (wallet == null) throw new Error('Wallet not found')

    let mnemonic: string
    try {
      mnemonic = decryptMnemonic(wallet.encryptedMnemonic, password)
    } catch {
      throw new Error('Invalid wallet password')
    }

    const sdk = this.sdkProvider.getPlatformSDK(wallet.network)
    const seed = sdk.keyPair.mnemonicToSeed(mnemonic)
    const hdKey = sdk.keyPair.seedToHdKey(seed, wallet.network)
    const coinType = COIN_TYPE[wallet.network]
    const accountId = 0

    const grouped = await this.addressDAO.getAddressesByWalletId(walletId)
    const chain = isChange ? grouped.change : grouped.receiving
    const index = chain.reduce((max, a) => Math.max(max, a.index), -1) + 1

    const derivationPath = `m/44'/${coinType}'/${accountId}'/${isChange ? 1 : 0}/${index}`
    const key = await sdk.keyPair.derivePath(hdKey, derivationPath)
    if (!key.publicKey) throw new Error(`Failed to derive public key at index ${index}`)
    const address = sdk.keyPair.p2pkhAddress(key.publicKey, wallet.network)

    await this.addressDAO.insertAddresses([{
      walletId,
      accountId,
      address,
      derivationPath,
      index,
      isChange,
      isUsed: false,
      label: null
    }])

    await this.walletSyncService.addWatchAddresses(walletId, [address])

    return address
  }

  discoverCoreAddresses(walletId: string): Promise<void> {
    const existing = this.discoveryInflight.get(walletId)
    if (existing) return existing
    const run = this.runCoreDiscovery(walletId).finally(() => this.discoveryInflight.delete(walletId))
    this.discoveryInflight.set(walletId, run)
    return run
  }

  private async runCoreDiscovery(walletId: string): Promise<void> {
    const wallet = await this.walletDAO.getWalletById(walletId)
    if (wallet == null || wallet.coreXpub == null) return

    const coreXpub = wallet.coreXpub
    const network = wallet.network
    const provider = this.getProvider(walletId, network)
    const sdk = this.sdkProvider.getPlatformSDK(network)
    const coinType = COIN_TYPE[network]
    const added: string[] = []

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

        const rows: Address[] = indexes.map(index => {
          const publicKey = deriveCorePublicKey(coreXpub, network, isChange, index)
          return {
            walletId,
            accountId: 0,
            address: sdk.keyPair.p2pkhAddress(publicKey, network),
            derivationPath: `m/44'/${coinType}'/0'/${isChange ? 1 : 0}/${index}`,
            index,
            isChange,
            isUsed: false,
            label: null
          }
        })
        await this.addressDAO.insertAddresses(rows)
        added.push(...rows.map(r => r.address))
      }
    }

    if (added.length > 0) {
      await this.walletSyncService.addWatchAddresses(walletId, added)
    }
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

  async getTransactions(walletId: string): Promise<Transaction[]> {
    const wallet = await this.walletDAO.getWalletById(walletId)

    if (wallet == null) {
      throw new Error('Wallet not found')
    }

    const addresses = await this.addressDAO.getAddressesByWalletId(walletId)
    const allAddresses = [...addresses.change, ...addresses.receiving]
    const provider = this.getProvider(wallet.walletId, wallet.network)
    const txArrays = await Promise.all(allAddresses.map(a => provider.getTransactions(a.address)))

    return dedupeTransactions(txArrays.flat())
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

  async getBlockByHash(hash: string, network: Network): Promise<BlockJSON> {
    if (network !== 'mainnet' && network !== 'testnet') {
      throw new Error('Invalid network ("mainnet", "testnet")')
    }

    // Routed via factory — throws Error('Unimplemented') in p2p mode.
    const wallet = await this.walletDAO.getSelectedWallet()
    if (wallet == null) {
      throw new Error('No selected wallet found')
    }
    const provider = this.getProvider(wallet.walletId, network)

    const block = await provider.getBlockByHash(hash)

    return block.toJSON()
  }

  async getWalletBalance(walletId: string): Promise<WalletBalance> {
    const wallet = await this.walletDAO.getWalletById(walletId)

    if (wallet == null) {
      throw new Error('Wallet not found')
    }

    const walletAddresses = await this.addressDAO.getAddressesByWalletId(walletId)
    const addresses = [...walletAddresses.change, ...walletAddresses.receiving]

    const identities = await this.identityDAO.getIdentitiesByWalletId(walletId)

    const provider = this.getProvider(wallet.walletId, wallet.network)

    const addressesBalance = await provider.getBalance(addresses.map(addr => addr.address))

    const platformSDK = this.sdkProvider.getPlatformSDK(wallet.network)
    const identitiesBalances = await Promise.allSettled(identities.map(async identity => platformSDK.identities.getIdentityBalance(identity.identifier)))
    const identitiesBalance = identitiesBalances.reduce((acc, result) => acc + (result.status === 'fulfilled' ? result.value : 0n), 0n)

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
  ): Promise<SendResult> {
    if (amountDuffs <= 0n) {
      throw new Error('Send amount must be greater than zero')
    }

    const wallet = await this.walletDAO.getWalletById(walletId)
    if (wallet == null) {
      throw new Error('Wallet not found')
    }
    const network = wallet.network

    const recipientType = this.coreTransactionService.classifyRecipientAddress(toAddress, network)

    let decryptedMnemonic: string
    try {
      decryptedMnemonic = decryptMnemonic(wallet.encryptedMnemonic, password)
    } catch {
      throw new Error('Invalid wallet password')
    }

    const {transferInputs, inputTotal, changeAddress, provider} = await this.gatherTransferInputs(walletId, network, amountDuffs)

    const tx = await this.coreTransactionService.buildSignedTransfer({
      inputs: transferInputs,
      toAddress,
      recipientType,
      amount: amountDuffs,
      changeAddress,
      inputTotal,
      mnemonic: decryptedMnemonic,
      network,
    })

    const txid = await provider.broadcastTx(tx)

    const outputTotal = tx.outputs.reduce((sum, output) => sum + output.satoshis, 0n)
    const actualFee = inputTotal - outputTotal
    const hasChange = tx.outputs.length > 1

    return {
      txid,
      amount: amountDuffs.toString(),
      fee: actualFee.toString(),
      toAddress,
      changeAddress: hasChange ? changeAddress : null,
      peersAcked: 0,
    }
  }

  async getTxLockStatus(walletId: string, txid: string): Promise<TxLockStatus> {
    const wallet = await this.walletDAO.getWalletById(walletId)
    if (wallet == null) {
      throw new Error('Wallet not found')
    }
    const provider = this.getProvider(wallet.walletId, wallet.network)
    return provider.getTxLockStatus(txid)
  }

  private async gatherTransferInputs(walletId: string, network: Network, amountDuffs: bigint): Promise<{
    transferInputs: TransferInput[]
    inputTotal: bigint
    changeAddress: string
    grouped: GroupedAddresses
    provider: WalletProvider
  }> {
    const grouped = await this.addressDAO.getAddressesByWalletId(walletId)
    const allAddresses = [...grouped.receiving, ...grouped.change]
    const pathByAddress = new Map(allAddresses.map(a => [a.address, a.derivationPath]))

    const provider = this.getProvider(walletId, network)
    await provider.ensureReady()

    const utxoLists = await Promise.all(
      allAddresses.map(async (a) => {
        const utxos = await provider.getUTXOs(a.address)
        return utxos.map(u => ({utxo: u, address: a.address}))
      }),
    )
    const ownedUtxos = utxoLists.flat()

    if (ownedUtxos.length === 0) {
      throw new Error('No spendable funds in this wallet')
    }

    const selectable: SelectableUtxo[] = ownedUtxos.map(({utxo, address}) => ({
      txid: utxo.txId,
      vout: utxo.vOut,
      satoshis: utxo.satoshis,
      address,
    }))

    const selection = selectCoins(selectable, amountDuffs)

    const utxoByKey = new Map(ownedUtxos.map(o => [`${o.utxo.txId}:${o.utxo.vOut}`, o]))

    const changeAddress = this.pickChangeAddress(grouped)

    const transferInputs: TransferInput[] = selection.inputs.map(input => {
      const owned = utxoByKey.get(`${input.txid}:${input.vout}`)
      if (!owned) throw new Error('Selected UTXO no longer available')

      const derivationPath = pathByAddress.get(input.address)
      if (derivationPath == null) throw new Error(`No derivation path for address ${input.address}`)

      return {
        txId: owned.utxo.txId,
        vOut: owned.utxo.vOut,
        script: owned.utxo.script,
        derivationPath,
        address: input.address,
      }
    })

    return {transferInputs, inputTotal: selection.inputTotal, changeAddress, grouped, provider}
  }

  async buildAndBroadcastAssetLock(walletId: string, amountDuffs: bigint, password: string, credit?: {address: string; derivationPath: string}): Promise<{
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

    let decryptedMnemonic: string
    try {
      decryptedMnemonic = decryptMnemonic(wallet.encryptedMnemonic, password)
    } catch {
      throw new Error('Invalid wallet password')
    }

    const {transferInputs, inputTotal, changeAddress, grouped, provider} = await this.gatherTransferInputs(walletId, network, amountDuffs)

    const creditTarget = credit ?? this.pickCreditChangeAddress(grouped, changeAddress)

    const tx = await this.coreTransactionService.buildSignedAssetLock({
      inputs: transferInputs,
      amountDuffs,
      creditAddress: creditTarget.address,
      changeAddress,
      inputTotal,
      mnemonic: decryptedMnemonic,
      network,
    })

    let txid: string
    try {
      txid = await provider.broadcastTx(tx)
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

  // Next unused change address, falling back to the first change address (or
  // the recipient-less wallet's first receiving address) so change never
  // leaves the wallet.
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

    const sdk = this.sdkProvider.getPlatformSDK(wallet.network)

    const stored = await this.identityDAO.getIdentitiesByWalletId(walletId)
    const results: IdentityInfo[] = []

    for (const entry of stored) {
      try {
        const identity = await sdk.identities.getIdentityByIdentifier(entry.identifier)
        const [aliasDocument] = await sdk.names.searchByIdentity(entry.identifier)
        const {label, parentDomainName} = aliasDocument?.properties ?? {}

        let alias: string | null = null

        if (label != null && parentDomainName != null) {
          alias = `${label}.${parentDomainName}`
        }

        // TODO: Implement read usd amount
        results.push({
          identityIndex: entry.identityIndex,
          identifier: identity.id.base58(),
          alias,
          balance: {
            amount: BigInt(identity.balance),
            usdAmount: '0.0'
          },
          derivationPath: entry.derivationPath,
          assetLockTxid: entry.assetLockTxid ?? null
        })
      } catch {
        // identity not registered on platform yet, skip
      }
    }

    return results
  }

  async getIdentityBalance(identifier: string): Promise<bigint> {
    const wallet = await this.walletDAO.getSelectedWallet()
    if (wallet == null) {
      throw new Error('No selected wallet found')
    }
    return this.sdkProvider.getPlatformSDK(wallet.network).identities.getIdentityBalance(identifier)
  }

  async getIdentityNonce(identifier: string): Promise<bigint> {
    const wallet = await this.walletDAO.getSelectedWallet()
    if (wallet == null) {
      throw new Error('No selected wallet found')
    }
    return this.sdkProvider.getPlatformSDK(wallet.network).identities.getIdentityNonce(identifier)
  }
}

