import {KeyPairController} from 'dash-platform-sdk/src/keyPair/index.js'
import {AddressDAO} from '../../database/AddressDAO'
import {WalletDAO} from '../../database/WalletDAO'
import {Network} from '../../types/Network'
import {COIN_TYPE, PLATFORM_ACCOUNT} from '../../constants'
import {decryptMnemonic, encryptMnemonic} from '../../utils'
import {coreAccountPath} from '../../utils/addressDiscovery'
import {requireWallet} from '../../utils/requireWallet'

// The mnemonic and the password never leave this class. Nothing here reaches a
// chain: it is the local wallet record, its encryption, and the derivation used
// to prove a seed belongs to it.
export class WalletCredentialsService {
  private walletDAO: WalletDAO
  private addressDAO: AddressDAO
  private pbkdf2Iterations: number
  // Derivation only — a DashPlatformSDK would build a gRPC pool and fetch the
  // evonode list to do local maths.
  private keyPair = new KeyPairController()

  constructor(walletDAO: WalletDAO, addressDAO: AddressDAO, pbkdf2Iterations: number) {
    this.walletDAO = walletDAO
    this.addressDAO = addressDAO
    this.pbkdf2Iterations = pbkdf2Iterations
  }

  async exportMnemonic(walletId: string, password: string): Promise<string> {
    const wallet = await requireWallet(this.walletDAO, walletId)

    const isValid = await this.verifyWalletPassword(walletId, password)
    if (!isValid) {
      throw new Error('Invalid password')
    }

    return decryptMnemonic(wallet.encryptedMnemonic, password)
  }

  async verifyWalletPassword(walletId: string, password: string): Promise<boolean> {
    const wallet = await requireWallet(this.walletDAO, walletId)

    let decryptedMnemonic: string

    try {
      decryptedMnemonic = decryptMnemonic(wallet.encryptedMnemonic, password)
    } catch {
      return false
    }

    const isValid = await this.mnemonicMatchesWallet(walletId, wallet.network, decryptedMnemonic)

    // Backfill for wallets created before the xpubs were persisted. This is the
    // only routine path that holds the seed, so it is where they can be filled.
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
    const wallet = await requireWallet(this.walletDAO, walletId)

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
}
