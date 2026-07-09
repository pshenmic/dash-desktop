import {randomBytes} from 'crypto'
import {DashPlatformSDK} from 'dash-platform-sdk'
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
import {
  InputAddressWASM,
  OutputAddressWASM,
  AddressFundsFeeStrategyStepWASM,
  AddressWitnessWASM,
  AddressFundsTransferTransitionWASM,
  IdentityTopUpFromAddressesTransitionWASM,
  PrivateKeyWASM,
} from 'dash-platform-sdk/types.js'
import {BlockJSON} from "dash-core-sdk/src/types";
import {QueryStatus} from "../types/QueryStatus";
import {WalletBalance} from "../types/WalletBalance";
import {Transaction} from "../types/Transaction";
import {SendResult} from "../types/SendResult";
import {selectCoins, SelectableUtxo} from "./coinSelection";
import {dedupeTransactions} from "./dedupeTransactions";
import {CoreTransactionService, TransferInput} from "./CoreTransactionService";
import {decryptMnemonic, encryptMnemonic} from "../utils";
import {coreAddressToPlatformAddress} from "./platformAddress";
import {PlatformAddressEntry} from "../types/PlatformAddress";
import {ShieldedMemoWASM} from 'pshenmic-dpp'
import {ShieldResult} from "../types/ShieldResult";
import {PlatformSendResult} from "../types/PlatformSendResult";
import {
  PlatformSourceCandidate,
  selectPlatformSource,
  selectPlatformInputsWithFee,
  topUpFeeCredits,
  TRANSFER_FEE_CREDITS,
} from "./platformTransfer";

const ADDRESS_LOOKAHEAD = 20
const IDENTITY_LOOKAHEAD = 10
const COIN_TYPE: Record<Network, number> = {mainnet: 5, testnet: 1}
const SHIELDED_ACCOUNT = 0

export class WalletService {
  private walletDAO: WalletDAO
  private addressDAO: AddressDAO
  private identityDAO: IdentityDAO
  private transactionDAO: TransactionDAO
  private applicationService: ApplicationService
  private walletSyncService: WalletSyncService
  private sdk: DashPlatformSDK
  private pbkdf2Iterations: number
  private coreTransactionService: CoreTransactionService

  constructor(
    walletDAO: WalletDAO,
    addressDAO: AddressDAO,
    identityDAO: IdentityDAO,
    transactionDAO: TransactionDAO,
    applicationService: ApplicationService,
    walletSyncService: WalletSyncService,
    sdk: DashPlatformSDK,
    pbkdf2Iterations: number,
  ) {
    this.pbkdf2Iterations = pbkdf2Iterations
    this.walletDAO = walletDAO
    this.addressDAO = addressDAO
    this.identityDAO = identityDAO
    this.transactionDAO = transactionDAO
    this.applicationService = applicationService
    this.walletSyncService = walletSyncService
    this.sdk = sdk
    this.coreTransactionService = new CoreTransactionService(sdk)
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

    this.sdk.setNetwork(network)

    const walletId = randomBytes(4).toString('hex')
    const encryptedMnemonic = encryptMnemonic(seedphrase, password, this.pbkdf2Iterations)

    await this.walletDAO.saveWallet(encryptedMnemonic, walletId, network, null)

    const seed = this.sdk.keyPair.mnemonicToSeed(seedphrase)
    const hdKey = this.sdk.keyPair.seedToHdKey(seed, network)
    const coinType = COIN_TYPE[network]
    const accountId = 0

    const addresses: Address[] = []

    for (let i = 0; i < ADDRESS_LOOKAHEAD; i++) {
      const key = await this.sdk.keyPair.derivePath(hdKey, `m/44'/${coinType}'/${accountId}'/0/${i}`)
      if (!key.publicKey) throw new Error(`Failed to derive public key at index ${i}`)
      const address = this.sdk.keyPair.p2pkhAddress(key.publicKey, network)
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
      const key = await this.sdk.keyPair.derivePath(hdKey, `m/44'/${coinType}'/${accountId}'/1/${i}`)
      if (!key.publicKey) throw new Error(`Failed to derive public key at index ${i}`)
      const address = this.sdk.keyPair.p2pkhAddress(key.publicKey, network)
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

    const identities: Identity[] = []

    for (let i = 0; i < IDENTITY_LOOKAHEAD; i++) {
      const key = this.sdk.keyPair.deriveIdentityPrivateKey(hdKey, i, 0, network)
      if (!key.publicKey) throw new Error(`Failed to derive identity public key at index ${i}`)

      const pkh = PrivateKeyWASM.fromBytes(key.privateKey as Uint8Array, network).getPublicKeyHash()

      let uniqueIdentity

      try {
        uniqueIdentity = await this.sdk.identities.getIdentityByPublicKeyHash(pkh)
      } catch {
        console.log(`Failed to fetch unique identity for publicKeyHash ${pkh}`)
      }

      let nonUniqueIdentity

      try {
        nonUniqueIdentity = await this.sdk.identities.getIdentityByNonUniquePublicKeyHash(pkh)
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

    const seed = this.sdk.keyPair.mnemonicToSeed(decryptedMnemonic)
    const hdKey = this.sdk.keyPair.seedToHdKey(seed, wallet.network)
    const coinType = COIN_TYPE[wallet.network]

    const key = await this.sdk.keyPair.derivePath(hdKey, `m/44'/${coinType}'/0'/1/${referenceWalletAddress.index}`)
    if (!key.publicKey) throw new Error(`Failed to derive public key at index ${referenceWalletAddress.index}`)

    const address = this.sdk.keyPair.p2pkhAddress(key.publicKey, wallet.network)

    return address === referenceWalletAddress.address;
  }

  async setAddressLabel(walletId: string, address: string, label: string): Promise<QueryStatus> {
    return this.addressDAO.setAddressLabel(walletId, address, label)
  }

  async setWalletLabel(walletId: string, label: string | null): Promise<QueryStatus> {
    return this.walletDAO.updateLabel(walletId, label)
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

    const identitiesBalances = await Promise.allSettled(identities.map(async identity => this.getIdentityBalance(identity.identifier)))
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

    const grouped = await this.addressDAO.getAddressesByWalletId(walletId)
    const allAddresses = [...grouped.receiving, ...grouped.change]
    const pathByAddress = new Map(allAddresses.map(a => [a.address, a.derivationPath]))

    const provider = this.getProvider(wallet.walletId, network)
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

    const tx = await this.coreTransactionService.buildSignedTransfer({
      inputs: transferInputs,
      toAddress,
      recipientType,
      amount: amountDuffs,
      changeAddress,
      inputTotal: selection.inputTotal,
      mnemonic: decryptedMnemonic,
      network,
    })

    const txid = await provider.broadcastTx(tx)

    const outputTotal = tx.outputs.reduce((sum, output) => sum + output.satoshis, 0n)
    const actualFee = selection.inputTotal - outputTotal
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

    this.sdk.setNetwork(wallet.network)

    const stored = await this.identityDAO.getIdentitiesByWalletId(walletId)
    const results: IdentityInfo[] = []

    for (const entry of stored) {
      try {
        const identity = await this.sdk.identities.getIdentityByIdentifier(entry.identifier)
        const [aliasDocument] = await this.sdk.names.searchByIdentity(entry.identifier)
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
          derivationPath: entry.derivationPath
        })
      } catch {
        // identity not registered on platform yet, skip
      }
    }

    return results
  }

  async getIdentityBalance(identifier: string): Promise<bigint> {
    return this.sdk.identities.getIdentityBalance(identifier)
  }

  async getIdentityNonce(identifier: string): Promise<bigint> {
    return this.sdk.identities.getIdentityNonce(identifier)
  }

  async getPlatformAddresses(walletId: string): Promise<PlatformAddressEntry[]> {
    const wallet = await this.walletDAO.getWalletById(walletId)

    if (wallet == null) {
      throw new Error('Wallet not found')
    }

    this.sdk.setNetwork(wallet.network)

    const candidates = await this.loadPlatformCandidates(walletId, wallet.network)
    return candidates.map(candidate => ({
      platformAddress: candidate.platformAddress,
      balanceCredits: candidate.balanceCredits.toString(),
      nonce: candidate.nonce,
    }))
  }

  private async loadPlatformCandidates(walletId: string, network: Network): Promise<PlatformSourceCandidate[]> {
    const owned = await this.buildPlatformOwned(walletId, network)
    const infoByPlatformAddress = await this.fetchPlatformAddressInfos(
      owned.map(entry => entry.platformAddress),
      network,
    )
    return owned.map(entry => {
      const info = infoByPlatformAddress.get(entry.platformAddress)
      return {
        ...entry,
        balanceCredits: info?.balance ?? 0n,
        nonce: info?.nonce ?? 0,
      }
    })
  }

  private async deriveAddressPrivateKey(
    hdKey: ReturnType<DashPlatformSDK['keyPair']['seedToHdKey']>,
    source: {derivationPath: string; coreAddress: string},
    network: Network,
  ): Promise<PrivateKeyWASM> {
    const derived = await this.sdk.keyPair.derivePath(hdKey, source.derivationPath)
    if (!derived.privateKey) {
      throw new Error(`Failed to derive private key for ${source.coreAddress}`)
    }
    return PrivateKeyWASM.fromBytes(derived.privateKey as Uint8Array, network)
  }

  private async signAddressInputs(
    signable: Uint8Array,
    sources: Array<{derivationPath: string; coreAddress: string}>,
    hdKey: ReturnType<DashPlatformSDK['keyPair']['seedToHdKey']>,
    network: Network,
  ): Promise<AddressWitnessWASM[]> {
    const witnesses: AddressWitnessWASM[] = []
    for (const source of sources) {
      const privateKey = await this.deriveAddressPrivateKey(hdKey, source, network)
      witnesses.push(AddressWitnessWASM.P2PKH(privateKey.sign(signable)))
    }
    return witnesses
  }

  private async buildPlatformOwned(
    walletId: string,
    network: Network,
  ): Promise<Array<{platformAddress: string; coreAddress: string; derivationPath: string}>> {
    const grouped = await this.addressDAO.getAddressesByWalletId(walletId)
    return [...grouped.receiving, ...grouped.change].map(address => ({
      platformAddress: coreAddressToPlatformAddress(address.address, network),
      coreAddress: address.address,
      derivationPath: address.derivationPath,
    }))
  }

  private async fetchPlatformAddressInfos(platformAddresses: string[], network: Network): Promise<Map<string, { balance: bigint; nonce: number }>> {
    const result = new Map<string, { balance: bigint; nonce: number }>()

    if (platformAddresses.length === 0) {
      return result
    }

    try {
      const infos = await this.sdk.platformAddresses.getAddressesInfos(platformAddresses)
      for (const info of infos) {
        result.set(info.address.toBech32m(network), { balance: info.balance, nonce: info.nonce })
      }
      return result
    } catch {
      const settled = await Promise.allSettled(
        platformAddresses.map(address => this.sdk.platformAddresses.getAddressInfo(address))
      )
      settled.forEach((outcome, i) => {
        if (outcome.status === 'fulfilled') {
          result.set(platformAddresses[i], { balance: outcome.value.balance, nonce: outcome.value.nonce })
        }
      })
      return result
    }
  }

  async sendPlatformTransfer(
    walletId: string,
    fromPlatformAddress: string,
    toPlatformAddress: string,
    amountCredits: bigint,
    password: string,
  ): Promise<PlatformSendResult> {
    if (amountCredits <= 0n) {
      throw new Error('Send amount must be greater than zero')
    }

    const wallet = await this.walletDAO.getWalletById(walletId)
    if (wallet == null) {
      throw new Error('Wallet not found')
    }
    const network = wallet.network

    this.sdk.setNetwork(network)

    let decryptedMnemonic: string
    try {
      decryptedMnemonic = decryptMnemonic(wallet.encryptedMnemonic, password)
    } catch {
      throw new Error('Invalid wallet password')
    }

    const candidates = await this.loadPlatformCandidates(walletId, network)

    const source = selectPlatformSource(candidates, amountCredits, fromPlatformAddress || undefined)

    if (toPlatformAddress === source.platformAddress) {
      throw new Error('Recipient must be different from the source address')
    }

    const seed = this.sdk.keyPair.mnemonicToSeed(decryptedMnemonic)
    const hdKey = this.sdk.keyPair.seedToHdKey(seed, network)

    const inputs = [new InputAddressWASM(source.platformAddress, source.nonce + 1, amountCredits)]
    const outputs = [new OutputAddressWASM(toPlatformAddress, amountCredits)]
    const feeStrategy = [AddressFundsFeeStrategyStepWASM.DeductFromInput(0)]

    const unsignedSt = this.sdk.platformAddresses.createStateTransition('addressFundsTransfer', {
      inputs,
      feeStrategy,
      userFeeIncrease: 0,
      inputWitness: [],
      outputs,
    })

    const signable = unsignedSt.getSignableBytes()
    const witnesses = await this.signAddressInputs(signable, [source], hdKey, network)

    const transition = AddressFundsTransferTransitionWASM.fromStateTransition(unsignedSt)
    transition.inputWitness = witnesses
    const signedSt = transition.toStateTransition()

    await this.sdk.stateTransitions.broadcast(signedSt)
    await this.sdk.stateTransitions.waitForStateTransitionResult(signedSt)

    return {
      stHash: signedSt.hash(false),
      amountCredits: amountCredits.toString(),
      feeCredits: TRANSFER_FEE_CREDITS.toString(),
      fromAddress: source.platformAddress,
      toAddress: toPlatformAddress,
    }
  }

  async topUpIdentityFromAddresses(
    walletId: string,
    identityId: string,
    fromPlatformAddress: string | null,
    amountCredits: bigint,
    password: string,
  ): Promise<PlatformSendResult> {
    if (amountCredits <= 0n) {
      throw new Error('Top-up amount must be greater than zero')
    }

    const wallet = await this.walletDAO.getWalletById(walletId)
    if (wallet == null) {
      throw new Error('Wallet not found')
    }
    const network = wallet.network

    this.sdk.setNetwork(network)

    let decryptedMnemonic: string
    try {
      decryptedMnemonic = decryptMnemonic(wallet.encryptedMnemonic, password)
    } catch {
      throw new Error('Invalid wallet password')
    }

    try {
      await this.sdk.identities.getIdentityByIdentifier(identityId)
    } catch {
      throw new Error('Identity not found on Platform')
    }

    const candidates = await this.loadPlatformCandidates(walletId, network)
    const plan = selectPlatformInputsWithFee(candidates, amountCredits, topUpFeeCredits, fromPlatformAddress ?? undefined)

    const seed = this.sdk.keyPair.mnemonicToSeed(decryptedMnemonic)
    const hdKey = this.sdk.keyPair.seedToHdKey(seed, network)

    const inputs = plan.inputs.map(({candidate, credits}) =>
      new InputAddressWASM(candidate.platformAddress, candidate.nonce + 1, credits))
    const feeStrategy = [AddressFundsFeeStrategyStepWASM.DeductFromInput(0)]

    const unsignedSt = this.sdk.platformAddresses.createStateTransition('identityTopUpFromAddresses', {
      identityId,
      inputs,
      feeStrategy,
      inputWitness: [],
      userFeeIncrease: 0,
    })

    const signable = unsignedSt.getSignableBytes()
    const witnesses = await this.signAddressInputs(signable, plan.inputs.map(input => input.candidate), hdKey, network)

    const transition = IdentityTopUpFromAddressesTransitionWASM.fromStateTransition(unsignedSt)
    transition.inputWitness = witnesses
    const signedSt = transition.toStateTransition()

    await this.sdk.stateTransitions.broadcast(signedSt)
    await this.sdk.stateTransitions.waitForStateTransitionResult(signedSt)

    return {
      stHash: signedSt.hash(false),
      amountCredits: amountCredits.toString(),
      feeCredits: plan.feeCredits.toString(),
      fromAddress: plan.inputs[0].candidate.platformAddress,
      toAddress: identityId,
    }
  }

  async shieldToPool(
    walletId: string,
    fromPlatformAddress: string,
    amountCredits: bigint,
    password: string,
  ): Promise<ShieldResult> {
    if (amountCredits <= 0n) {
      throw new Error('Shield amount must be greater than zero')
    }

    const wallet = await this.walletDAO.getWalletById(walletId)
    if (wallet == null) {
      throw new Error('Wallet not found')
    }
    const network = wallet.network

    this.sdk.setNetwork(network)

    let decryptedMnemonic: string
    try {
      decryptedMnemonic = decryptMnemonic(wallet.encryptedMnemonic, password)
    } catch {
      throw new Error('Invalid wallet password')
    }

    const candidates = await this.loadPlatformCandidates(walletId, network)

    const source = selectPlatformSource(candidates, amountCredits, fromPlatformAddress || undefined)

    const seed = this.sdk.keyPair.mnemonicToSeed(decryptedMnemonic)
    const hdKey = this.sdk.keyPair.seedToHdKey(seed, network)
    const privateKey = await this.deriveAddressPrivateKey(hdKey, source, network)

    const recipient = this.sdk.keyPair.deriveShieldedAddress(seed, network, SHIELDED_ACCOUNT)
    const senderOvk = this.sdk.keyPair.deriveShieldedOutgoingViewingKey(seed, network, SHIELDED_ACCOUNT)

    const inputs = [new InputAddressWASM(source.platformAddress, source.nonce + 1, source.balanceCredits)]
    const feeStrategy = [AddressFundsFeeStrategyStepWASM.DeductFromInput(0)]

    const stateTransition = await this.sdk.shielded.createStateTransition('shield', {
      recipient,
      shieldAmount: amountCredits,
      inputs,
      privateKeys: [privateKey],
      feeStrategy,
      userFeeIncrease: 0,
      memo: ShieldedMemoWASM.empty() as unknown as string,
      senderOvk,
    })

    await this.sdk.stateTransitions.broadcast(stateTransition)
    await this.sdk.stateTransitions.waitForStateTransitionResult(stateTransition)

    return {
      stHash: stateTransition.hash(false),
      amountCredits: amountCredits.toString(),
      fromAddress: source.platformAddress,
    }
  }
}

