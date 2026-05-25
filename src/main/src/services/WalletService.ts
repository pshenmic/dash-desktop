import {createCipheriv, randomBytes} from 'crypto'
import {DashPlatformSDK} from 'dash-platform-sdk'
import {WalletDAO} from '../database/WalletDAO'
import {AddressDAO} from '../database/AddressDAO'
import {IdentityDAO} from '../database/IdentityDAO'
import {TransactionDAO} from '../database/TransactionDAO'
import {ApplicationService} from './ApplicationService'
import {WalletProvider} from '../providers/WalletProvider'
import {InsightWalletProvider} from '../providers/InsightWalletProvider'
import {P2PWalletProvider} from '../providers/P2PWalletProvider'
import {Network} from '../types'
import {Address} from '../types/Address'
import {GroupedAddresses} from '../types/GroupedAddresses'
import {Identity, IdentityInfo} from '../types/Identity'
import {Wallet} from '../types/Wallet'
import {PrivateKeyWASM} from 'pshenmic-dpp'
import {BlockJSON} from "dash-core-sdk/src/types";
import {QueryStatus} from "../types/QueryStatus";
import {WalletBalance} from "../types/WalletBalance";
import {Transaction} from "../types/Transaction";
import {deriveKeyFromPassword} from "../utils";
import {createDecipheriv} from "node:crypto";

const ADDRESS_LOOKAHEAD = 20
const IDENTITY_LOOKAHEAD = 10
const COIN_TYPE: Record<Network, number> = {mainnet: 5, testnet: 1}

function encryptMnemonic(mnemonic: string, password: string, iterations: number): string {
  const salt = randomBytes(32)
  const passwordKey = deriveKeyFromPassword(password, iterations, salt)

  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', passwordKey, iv)
  const ciphertext = Buffer.concat([cipher.update(mnemonic, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  const iterBuf = Buffer.alloc(4)
  iterBuf.writeUInt32BE(iterations)

  return Buffer.concat([iv, salt, iterBuf, ciphertext, tag]).toString('hex')
}

function decryptMnemonic(encryptedHex: string, password: string): string {
  const data = Buffer.from(encryptedHex, 'hex')

  const iv = data.slice(0, 12)
  const salt = data.slice(12, 44)
  const iterations = data.readUInt32BE(44)
  const tag = data.slice(data.length - 16)
  const ciphertext = data.slice(48, data.length - 16)

  const passwordKey = deriveKeyFromPassword(password, iterations, salt)

  const decipher = createDecipheriv('aes-256-gcm', passwordKey, iv)
  decipher.setAuthTag(tag)

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString('utf8')
}

export class WalletService {
  private walletDAO: WalletDAO
  private addressDAO: AddressDAO
  private identityDAO: IdentityDAO
  private transactionDAO: TransactionDAO
  private applicationService: ApplicationService
  private sdk: DashPlatformSDK
  private pbkdf2Iterations: number

  constructor(
    walletDAO: WalletDAO,
    addressDAO: AddressDAO,
    identityDAO: IdentityDAO,
    transactionDAO: TransactionDAO,
    applicationService: ApplicationService,
    sdk: DashPlatformSDK,
    pbkdf2Iterations: number,
  ) {
    this.pbkdf2Iterations = pbkdf2Iterations
    this.walletDAO = walletDAO
    this.addressDAO = addressDAO
    this.identityDAO = identityDAO
    this.transactionDAO = transactionDAO
    this.applicationService = applicationService
    this.sdk = sdk
  }

  private getProvider(walletId: string, network: Network): WalletProvider {
    if (this.applicationService.preferences.general.connectionType === 'p2p') {
      return new P2PWalletProvider(this.transactionDAO, walletId)
    }
    return new InsightWalletProvider(network, walletId, this.addressDAO)
  }

  async createWallet(seedphrase: string, network: Network, password: string): Promise<string> {
    if (seedphrase.trim().split(/\s+/).length !== 12) {
      throw new Error('Seedphrase must be 12 words')
    }

    if (network !== 'mainnet' && network !== 'testnet') {
      throw new Error('Invalid network ("mainnet", "testnet")')
    }

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

    return txArrays.flat().sort((a, b) => b?.date?.getTime() - a?.date?.getTime())
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

    const identitiesBalances = await Promise.all(identities.map(async identity => this.getIdentityBalance(identity.identifier)))
    const identitiesBalance = identitiesBalances.reduce((acc, curr) => acc + curr, BigInt(0))

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
}
