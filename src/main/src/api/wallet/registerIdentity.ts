import {IpcMainInvokeEvent} from 'electron/utility'
import {WalletDAO} from '../../database/WalletDAO'
import {IdentityDAO} from '../../database/IdentityDAO'
import {WalletService} from '../../services/WalletService'
import {SdkProvider} from '../../services/SdkProvider'
import {IdentityRegistrationService} from '../../services/IdentityRegistrationService'
import {RegisterIdentityResult} from '../../types/RegisterIdentityResult'
import {decryptMnemonic} from '../../utils'

const ALREADY_IN_CHAIN_MESSAGE = 'state transition already in chain'

// Orchestrates identity registration: fund an L1 asset lock from wallet UTXOs,
// wait for its instant/chain lock proof, then broadcast a Platform
// IdentityCreateTransition. Unlike the browser extension there is no one-time
// funding key — the asset lock is funded directly from the wallet's own UTXOs.
export class RegisterIdentityHandler {
  constructor(
    private readonly walletDAO: WalletDAO,
    private readonly identityDAO: IdentityDAO,
    private readonly walletService: WalletService,
    private readonly sdkProvider: SdkProvider,
    private readonly identityRegistrationService: IdentityRegistrationService,
  ) {}

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    lockAmount: string,
    password: string,
  ): Promise<RegisterIdentityResult> => {
    const lockAmountDuffs = BigInt(lockAmount)
    if (lockAmountDuffs <= 0n) {
      throw new Error('Lock amount must be greater than zero')
    }

    const wallet = await this.walletDAO.getWalletById(walletId)
    if (wallet == null) {
      throw new Error('Wallet not found')
    }
    const network = wallet.network

    let mnemonic: string
    try {
      mnemonic = decryptMnemonic(wallet.encryptedMnemonic, password)
    } catch {
      throw new Error('Invalid wallet password')
    }

    // Identity index + the keys derived from it. findNextIdentityIndex scans
    // past indices whose auth key is already registered on Platform.
    const localIdentities = await this.identityDAO.getIdentitiesByWalletId(walletId)
    const startIndex = localIdentities.reduce((max, identity) => Math.max(max, identity.identityIndex + 1), 0)
    const identityIndex = await this.identityRegistrationService.findNextIdentityIndex(mnemonic, startIndex, network)

    const registrationKey = await this.identityRegistrationService.deriveRegistrationKey(mnemonic, identityIndex, network)
    const creditAddress = this.sdkProvider.getPlatformSDK(network).keyPair.p2pkhAddress(registrationKey.getPublicKey().bytes(), network)

    // Fund the asset lock from wallet UTXOs (same collection + selection +
    // broadcast path as a normal send), directing the credits to the
    // registration key.
    const {tx: assetLockTx, txid: assetLockTxid, inputAddresses} = await this.walletService.buildAndBroadcastAssetLock(
      walletId,
      lockAmountDuffs,
      password,
      {address: creditAddress, derivationPath: this.identityRegistrationService.registrationKeyPath(identityIndex, network)},
    )

    const assetLockProof = await this.identityRegistrationService.waitForAssetLockProof(
      assetLockTx,
      assetLockTxid,
      inputAddresses,
      network,
    )

    const identityKeys = await this.identityRegistrationService.deriveIdentityKeys(mnemonic, identityIndex, network)
    const stateTransition = this.identityRegistrationService.buildIdentityCreateTransition(
      identityKeys,
      registrationKey,
      assetLockProof,
      network,
    )

    const identifier = stateTransition.getOwnerId()?.base58()
    if (identifier == null || identifier === '') {
      throw new Error('Could not derive identity identifier from state transition')
    }
    const stateTransitionHash = stateTransition.hash(false)

    // Persist before broadcasting so a crash leaves a recoverable record. Roll
    // back on a non-idempotent broadcast failure so local state never holds a
    // phantom identity. A pre-existing record (a previous attempt) is treated
    // as recovery.
    const coinType = network === 'mainnet' ? 5 : 1
    const existing = await this.identityDAO.getByIdentifier(walletId, identifier)
    let wasJustCreated = false
    if (existing == null) {
      await this.identityDAO.insertIdentity({
        walletId,
        identityIndex,
        identifier,
        derivationPath: `m/9'/${coinType}'/0'/0/${identityIndex}`,
      }, assetLockTxid)
      wasJustCreated = true
    }

    const platformSDK = this.sdkProvider.getPlatformSDK(network)
    let alreadyOnPlatform = false
    try {
      await platformSDK.stateTransitions.broadcast(stateTransition)
    } catch (e) {
      if (this.isAlreadyInChain(e)) {
        alreadyOnPlatform = true
      } else {
        if (wasJustCreated) {
          await this.identityDAO.removeIdentity(walletId, identifier)
        }
        throw e
      }
    }

    if (!alreadyOnPlatform) {
      await platformSDK.stateTransitions.waitForStateTransitionResult(stateTransition)
    }

    return {identifier, stateTransitionHash}
  }

  private isAlreadyInChain(e: unknown): boolean {
    const message = e instanceof Error ? e.message : String(e ?? '')
    return message.includes(ALREADY_IN_CHAIN_MESSAGE)
  }
}
