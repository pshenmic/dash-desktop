import {AddressDAO} from '../database/AddressDAO'
import {WalletDAO} from '../database/WalletDAO'
import {WalletProviderFactory} from '../providers/WalletProviderFactory'
import {AssetLockFunder, BuiltAssetLock} from '../types/AssetLock'
import {Network} from '../types/Network'
import {Transaction} from '../types/Transaction'
import {TxLockStatus} from '../types/TxLockStatus'
import {pickCreditChangeAddress, selectTransferInputs} from '../utils/transferInputs'
import {CoreTransactionService} from './CoreTransactionService'
import {WalletSyncService} from './WalletSyncService'

export class CoreLockService implements AssetLockFunder {
  private walletDAO: WalletDAO
  private addressDAO: AddressDAO
  private walletSyncService: WalletSyncService
  private coreTransactionService: CoreTransactionService
  private providers: WalletProviderFactory

  constructor(
    walletDAO: WalletDAO,
    addressDAO: AddressDAO,
    walletSyncService: WalletSyncService,
    coreTransactionService: CoreTransactionService,
    providers: WalletProviderFactory,
  ) {
    this.walletDAO = walletDAO
    this.addressDAO = addressDAO
    this.walletSyncService = walletSyncService
    this.coreTransactionService = coreTransactionService
    this.providers = providers
  }

  async buildAssetLock(
    walletId: string,
    amountDuffs: bigint,
    seed: Uint8Array,
    credit?: {address: string; derivationPath: string},
  ): Promise<BuiltAssetLock> {
    if (amountDuffs <= 0n) {
      throw new Error('Amount must be greater than zero')
    }

    const wallet = await this.walletDAO.getWalletById(walletId)
    if (wallet == null) {
      throw new Error('Wallet not found')
    }
    const network = wallet.network

    const grouped = await this.addressDAO.getAddressesByWalletId(walletId)
    const provider = this.providers.forWallet(walletId, network)
    await provider.ensureReady()
    const {transferInputs, inputTotal, changeAddress} =
      selectTransferInputs(grouped, await provider.getWalletUtxos(), amountDuffs)

    const creditTarget = credit ?? pickCreditChangeAddress(grouped, changeAddress)

    const tx = await this.coreTransactionService.buildSignedAssetLock({
      inputs: transferInputs,
      amountDuffs,
      creditAddress: creditTarget.address,
      changeAddress,
      inputTotal,
      seed,
      network,
    })

    return {
      tx,
      txid: tx.hash(),
      creditAddress: creditTarget.address,
      creditDerivationPath: creditTarget.derivationPath,
      inputAddresses: transferInputs.map(input => input.address),
    }
  }

  async broadcastAssetLock(txHex: string): Promise<void> {
    try {
      await this.walletSyncService.broadcastTransaction(txHex)
    } catch (error) {
      console.error('Asset lock broadcast failed, rawtx:', txHex)
      throw error
    }
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

  async getTxLockStatus(walletId: string, txid: string): Promise<TxLockStatus> {
    const wallet = await this.walletDAO.getWalletById(walletId)
    if (wallet == null) {
      throw new Error('Wallet not found')
    }
    const status = await this.providers.forWallet(walletId, wallet.network).getTxLockStatus(txid)
    if (status.instantLocked) return status
    // The isdlock arrives on our own pool in both modes, but rpc mode keeps no
    // local row for markInstantLocked to have written it to.
    return {...status, instantLocked: this.walletSyncService.hasInstantLock(txid)}
  }

  // Wallet-scoped, unlike WalletService.getTransactionByHash: a resume reads the
  // funding's own wallet, which is not necessarily the selected one.
  async getTransaction(walletId: string, txid: string): Promise<Transaction> {
    const wallet = await this.walletDAO.getWalletById(walletId)
    if (wallet == null) {
      throw new Error('Wallet not found')
    }
    return this.providers.forWallet(walletId, wallet.network).getTransactionByHash(txid)
  }

  async getUsedAddresses(walletId: string, addresses: string[]): Promise<string[]> {
    const wallet = await this.walletDAO.getWalletById(walletId)
    if (wallet == null) throw new Error('Wallet not found')
    return this.providers.forWallet(walletId, wallet.network).getUsedAddresses(addresses)
  }
}
