import {randomBytes} from 'crypto'
import {KeyPairController} from 'dash-platform-sdk/src/keyPair/index.js'
import {PlatformWorkerService} from '../platform/PlatformWorkerService'
import {WalletDAO} from '../../database/WalletDAO'
import {AddressDAO} from '../../database/AddressDAO'
import {IdentityDAO} from '../../database/IdentityDAO'
import {WalletProviderFactory} from '../../providers/WalletProviderFactory'
import {Network} from '../../types/Network'
import {Address} from '../../types/Address'
import {GroupedAddresses} from '../../types/GroupedAddresses'
import {Wallet} from '../../types/Wallet'
import {WalletBalance} from "../../types/WalletBalance";
import {Transaction} from "../../types/Transaction";
import {SendResult} from "../../types/SendResult";
import {IdentityService} from '../platform/IdentityService'
import {CoreTransactionService} from '../core/CoreTransactionService'
import {CoreDiscoveryService} from '../core/CoreDiscoveryService'
import {WalletSyncService} from '../core/WalletSyncService'
import {encryptMnemonic} from "../../utils";
import {withUnlockedWallet} from "../../utils/walletSeed";
import {requireSelectedWallet, requireWallet} from '../../utils/requireWallet'
import {
  COIN_TYPE,
  CORE_ADDRESS_WINDOW,
  IDENTITY_LOOKAHEAD,
  IDENTITY_SCAN_LIMIT,
  PLATFORM_ACCOUNT,
} from '../../constants/addresses'
import {coreFeeDuffsFor} from '../../utils/coreFeeRate'
import {identityPath} from '../../utils/identityKeys'
import {coreAccountPath, coreAddressDeriver} from "../../utils/addressDiscovery";
import {selectTransferInputs} from '../../utils/transferInputs'
import {Preferences} from '../../preferences'
import {ConnectionStatus} from '../../types/ConnectionStatus'

export class WalletService {
  private walletDAO: WalletDAO
  private addressDAO: AddressDAO
  private identityDAO: IdentityDAO
  private identities: IdentityService
  private walletSyncService: WalletSyncService
  private platform: PlatformWorkerService
  private providers: WalletProviderFactory
  private discovery: CoreDiscoveryService
  private coreTransactionService: CoreTransactionService
  private preferences: Preferences
  private pbkdf2Iterations: number
  // Derivation only — a DashPlatformSDK would build a gRPC pool and fetch the
  // evonode list to do local maths.
  private keyPair = new KeyPairController()

  constructor(
    walletDAO: WalletDAO,
    addressDAO: AddressDAO,
    identityDAO: IdentityDAO,
    identities: IdentityService,
    walletSyncService: WalletSyncService,
    platform: PlatformWorkerService,
    providers: WalletProviderFactory,
    discovery: CoreDiscoveryService,
    coreTransactionService: CoreTransactionService,
    preferences: Preferences,
    pbkdf2Iterations: number,
  ) {
    this.walletDAO = walletDAO
    this.addressDAO = addressDAO
    this.identityDAO = identityDAO
    this.identities = identities
    this.walletSyncService = walletSyncService
    this.platform = platform
    this.providers = providers
    this.discovery = discovery
    this.coreTransactionService = coreTransactionService
    this.preferences = preferences
    this.pbkdf2Iterations = pbkdf2Iterations
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

    const coreXpub = coreAccountNode.publicExtendedKey
    const addresses: Address[] = []

    for (const isChange of [false, true]) {
      const deriver = coreAddressDeriver(coreXpub, network, isChange)
      for (let index = 0; index < CORE_ADDRESS_WINDOW.gapLimit; index++) {
        const {address, derivationPath} = deriver.derive(index)
        addresses.push({walletId, accountId, address, derivationPath, index, isChange, isUsed: false, label: null})
      }
    }

    await this.addressDAO.insertAddresses(addresses)

    try {
      await this.discovery.discoverCoreAddresses(walletId)
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

  async deleteWallet(walletId: string): Promise<void> {
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

  async getConnectionStatus(wallet: Wallet): Promise<ConnectionStatus> {
    try {
      return await this.providers
        .forWallet(wallet.walletId, wallet.network)
        .getConnectionStatus()
    } catch {
      return 'unavailable'
    }
  }

  async setSelectedWallet(walletId: string): Promise<void> {
    await this.walletDAO.setSelectedWallet(walletId)

    const wallet = await this.walletDAO.getWalletById(walletId)
    if (wallet != null) {
      await this.walletSyncService.startLockListen(wallet.network, walletId)
        .catch(err => console.error('[locks] failed to start lock listener:', err))
    }
  }

  async setAddressLabel(walletId: string, address: string, label: string): Promise<void> {
    return this.addressDAO.setAddressLabel(walletId, address, label)
  }

  async setWalletLabel(walletId: string, label: string | null): Promise<void> {
    return this.walletDAO.updateLabel(walletId, label)
  }

  // No password: the account xpub is persisted, and a receive address is public
  // derivation off it. Only signing needs the seed.
  async addAddress(walletId: string, isChange: boolean): Promise<string> {
    const wallet = await requireWallet(this.walletDAO, walletId)
    if (wallet.coreXpub == null) {
      throw new Error('Wallet addresses are not derived yet')
    }

    const grouped = await this.addressDAO.getAddressesByWalletId(walletId)
    const chain = isChange ? grouped.change : grouped.receiving
    const index = chain.reduce((max, a) => Math.max(max, a.index), -1) + 1
    const {address, derivationPath} = coreAddressDeriver(wallet.coreXpub, wallet.network, isChange).derive(index)

    const row: Address = {
      walletId,
      accountId: 0,
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

  async getReceiveAddress(walletId: string): Promise<string> {
    const wallet = await requireWallet(this.walletDAO, walletId)

    const provider = this.providers.forWallet(wallet.walletId, wallet.network)
    return provider.nextUnusedAddress()
  }

  async getAddressesByWalletId(walletId: string): Promise<GroupedAddresses> {
    const wallet = await requireWallet(this.walletDAO, walletId)

    const addresses = await this.addressDAO.getAddressesByWalletId(walletId)

    const provider = this.providers.forWallet(wallet.walletId, wallet.network)

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
    const wallet = await requireWallet(this.walletDAO, walletId)

    const provider = this.providers.forWallet(wallet.walletId, wallet.network)

    return provider.getWalletTransactions()
  }

  async getTransactionByHash(hash: string, network: Network): Promise<Transaction> {
    if (network !== 'mainnet' && network !== 'testnet') {
      throw new Error('Invalid network ("mainnet", "testnet")')
    }

    const wallet = await requireSelectedWallet(this.walletDAO)

    const provider = this.providers.forWallet(wallet.walletId, network)

    return provider.getTransactionByHash(hash)
  }

  async getWalletBalance(walletId: string): Promise<WalletBalance> {
    const wallet = await requireWallet(this.walletDAO, walletId)

    const provider = this.providers.forWallet(wallet.walletId, wallet.network)

    const addressesBalance = await provider.getWalletBalance()
    const identitiesBalance = await this.identities.totalCredits(walletId, wallet.network)

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

    const wallet = await requireSelectedWallet(this.walletDAO)
    const provider = this.providers.forWallet(wallet.walletId, network)

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
      const grouped = await this.addressDAO.getAddressesByWalletId(walletId)
      const provider = this.providers.forWallet(walletId, network)
      await provider.ensureReady()
      const {coreFeeMultiplier} = this.preferences.general
      const {transferInputs, inputTotal, changeAddress, feeDuffs} =
        selectTransferInputs(
          grouped,
          await provider.getWalletUtxos(),
          amountDuffs,
          inputsCount => coreFeeDuffsFor(coreFeeMultiplier, inputsCount, 1, true),
          fromAddress,
        )

      const tx = await this.coreTransactionService.buildSignedTransfer({
        inputs: transferInputs,
        toAddress,
        recipientType,
        amount: amountDuffs,
        changeAddress,
        inputTotal,
        feeDuffs,
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
}
