import {PrivateKeyWASM} from 'dash-platform-sdk/types.js'
import {SdkProvider} from '../providers/SdkProvider'
import {WalletDAO} from '../database/WalletDAO'
import {IdentityDAO} from '../database/IdentityDAO'
import {AssetLockFundingRow} from '../database/AssetLockDAO'
import {AssetLockFundingState} from '../types/AssetLockFunding'
import {Network} from '../types'
import {AcquiredAssetLock, AssetLockService} from './AssetLockService'
import {PlatformWorkerService} from './PlatformWorkerService'
import {decryptMnemonic} from '../utils'
import {identityPath} from '../utils/identityKeys'
import {COIN_TYPE} from '../constants'

export {IDENTITY_KEY_DEFINITIONS} from '../utils/identityKeys'

// Upper bound on the on-chain free-index scan — guards against an infinite
// loop if Platform keeps reporting an identity for every derived auth key.
const IDENTITY_INDEX_SCAN_LIMIT = 100

interface Unlocked {
  network: Network
  mnemonic: string
  seed: Uint8Array
}

// Owns identity registration and top-up funded from L1: derives the funding
// keys, drives an asset lock through AssetLockService, and settles the proof
// into the matching platform worker operation.
export class IdentityRegistrationService {
  constructor(
    private readonly sdkProvider: SdkProvider,
    private readonly walletDAO: WalletDAO,
    private readonly identityDAO: IdentityDAO,
    private readonly assetLock: AssetLockService,
    private readonly platform: PlatformWorkerService,
  ) {}

  registrationKeyPath(identityIndex: number, network: Network): string {
    return this.fundingKeyPath(1, identityIndex, network)
  }

  topUpKeyPath(index: number, network: Network): string {
    return this.fundingKeyPath(2, index, network)
  }

  // DIP-0013 identity funding branch m/9'/coin'/5'/usage'/index: usage 1 funds
  // registrations, usage 2 funds top-ups.
  private fundingKeyPath(usage: number, index: number, network: Network): string {
    return `m/9'/${COIN_TYPE[network]}'/5'/${usage}'/${index}`
  }

  // Registration key (DIP-0013 m/9'/coin'/5'/1'/index): owns the asset-lock
  // credit output and signs the IdentityCreateTransition. Derived from seed, so
  // recoverable without local storage.
  async deriveRegistrationKey(mnemonic: string, identityIndex: number, network: Network): Promise<PrivateKeyWASM> {
    return this.deriveFundingKey(mnemonic, this.registrationKeyPath(identityIndex, network), network)
  }

  async deriveTopUpKey(mnemonic: string, index: number, network: Network): Promise<PrivateKeyWASM> {
    return this.deriveFundingKey(mnemonic, this.topUpKeyPath(index, network), network)
  }

  private async deriveFundingKey(mnemonic: string, path: string, network: Network): Promise<PrivateKeyWASM> {
    const keyPair = this.sdkProvider.getPlatformSDK(network).keyPair
    const hdKey = keyPair.seedToHdKey(keyPair.mnemonicToSeed(mnemonic), network)
    const {privateKey} = await keyPair.derivePath(hdKey, path)
    if (privateKey == null) {
      throw new Error(`Could not derive identity funding key at ${path} from wallet hd key`)
    }
    return PrivateKeyWASM.fromBytes(privateKey, network)
  }

  // First index at/after startIndex whose auth key #0 is not already registered
  // on Platform — skips indices taken by the same seed used elsewhere.
  async findNextIdentityIndex(mnemonic: string, startIndex: number, network: Network): Promise<number> {
    const sdk = this.sdkProvider.getPlatformSDK(network)
    const hdKey = sdk.keyPair.seedToHdKey(sdk.keyPair.mnemonicToSeed(mnemonic), network)

    let index = startIndex
    for (let scanned = 0; scanned < IDENTITY_INDEX_SCAN_LIMIT; scanned++) {
      const derived = sdk.keyPair.deriveIdentityPrivateKey(hdKey, index, 0, network)
      if (derived.privateKey == null) {
        throw new Error(`Could not derive identity key at index ${index}`)
      }
      const pkh = PrivateKeyWASM.fromBytes(derived.privateKey, network).getPublicKeyHash()

      const existing =
        await sdk.identities.getIdentityByPublicKeyHash(pkh).catch(() => null) ??
        await sdk.identities.getIdentityByNonUniquePublicKeyHash(pkh).catch(() => null)

      if (existing == null) {
        return index
      }
      index++
    }
    throw new Error(`Could not find a free identity index within ${IDENTITY_INDEX_SCAN_LIMIT} attempts`)
  }

  async startIdentityCreate(walletId: string, amountDuffs: bigint, password: string): Promise<AssetLockFundingState> {
    const unlocked = await this.unlock(walletId, password)
    const {identityIndex, credit} = await this.prepareRegistration(walletId, unlocked)

    const state = await this.assetLock.begin(walletId, 'identity', '', amountDuffs)
    void this.run(state, async () => {
      const acquired = await this.assetLock.acquire(state, {
        walletId, kind: 'identity', destination: '', amountDuffs, password, credit, identityIndex,
      })
      await this.settleCreate(walletId, unlocked, state, acquired, identityIndex)
    })
    return state
  }

  async startIdentityTopUp(walletId: string, identityId: string, amountDuffs: bigint, password: string): Promise<AssetLockFundingState> {
    if (identityId.trim().length === 0) {
      throw new Error('Identity identifier is required')
    }
    const unlocked = await this.unlock(walletId, password)
    const {topUpIndex, credit} = await this.prepareTopUp(walletId, unlocked)

    const state = await this.assetLock.begin(walletId, 'identityTopUp', identityId, amountDuffs)
    void this.run(state, async () => {
      const acquired = await this.assetLock.acquire(state, {
        walletId, kind: 'identityTopUp', destination: identityId, amountDuffs, password,
        credit, identityIndex: topUpIndex,
      })
      await this.settleTopUp(unlocked, state, acquired)
    })
    return state
  }

  // Resumes a funding whose L1 lock already landed. Both identity kinds route
  // here; the row says which.
  async resume(walletId: string, row: AssetLockFundingRow, password: string): Promise<AssetLockFundingState> {
    const unlocked = await this.unlock(walletId, password)
    if (row.identityIndex == null) {
      throw new Error('Funding record is missing the identity index')
    }
    const identityIndex = row.identityIndex

    const state = this.assetLock.resume(walletId, row)
    void this.run(state, async () => {
      const acquired = await this.assetLock.reacquire(state, row)
      if (row.kind === 'identityTopUp') {
        await this.settleTopUp(unlocked, state, acquired)
      } else {
        await this.settleCreate(walletId, unlocked, state, acquired, identityIndex)
      }
    })
    return state
  }

  private run(state: AssetLockFundingState, work: () => Promise<void>): Promise<void> {
    return work().catch(error => this.assetLock.fail(state, error))
  }

  private async settleCreate(
    walletId: string,
    unlocked: Unlocked,
    state: AssetLockFundingState,
    {row, proof}: AcquiredAssetLock,
    identityIndex: number,
  ): Promise<void> {
    await this.assetLock.markBroadcastingSt(state, row.txid)

    const {stHash, identifier} = await this.platform.request('identityCreateFromAssetLock', unlocked.network, {
      seed: unlocked.seed,
      txid: row.txid,
      outputIndex: row.outputIndex,
      assetLockProof: proof,
      creditDerivationPath: row.creditDerivationPath,
      identityIndex,
    })

    const existing = await this.identityDAO.getByIdentifier(walletId, identifier)
    if (existing == null) {
      await this.identityDAO.insertIdentity({
        walletId,
        identityIndex,
        identifier,
        derivationPath: identityPath(unlocked.network, identityIndex),
      }, row.txid)
    }

    state.identityIdentifier = identifier
    await this.assetLock.done(state, row.txid, stHash)
  }

  private async settleTopUp(unlocked: Unlocked, state: AssetLockFundingState, {row, proof}: AcquiredAssetLock): Promise<void> {
    await this.assetLock.markBroadcastingSt(state, row.txid)

    const {stHash} = await this.platform.request('identityTopUpFromAssetLock', unlocked.network, {
      seed: unlocked.seed,
      txid: row.txid,
      outputIndex: row.outputIndex,
      assetLockProof: proof,
      creditDerivationPath: row.creditDerivationPath,
      identifier: row.toPlatformAddress,
    })

    state.identityIdentifier = row.toPlatformAddress
    await this.assetLock.done(state, row.txid, stHash)
  }

  private async prepareRegistration(walletId: string, unlocked: Unlocked): Promise<{identityIndex: number; credit: {address: string; derivationPath: string}}> {
    const {network, mnemonic} = unlocked
    const localIdentities = await this.identityDAO.getIdentitiesByWalletId(walletId)
    const startIndex = localIdentities.reduce((max, identity) => Math.max(max, identity.identityIndex + 1), 0)
    const identityIndex = await this.findNextIdentityIndex(mnemonic, startIndex, network)

    const registrationKey = await this.deriveRegistrationKey(mnemonic, identityIndex, network)

    return {
      identityIndex,
      credit: {
        address: this.p2pkhAddress(registrationKey, network),
        derivationPath: this.registrationKeyPath(identityIndex, network),
      },
    }
  }

  private async prepareTopUp(walletId: string, unlocked: Unlocked): Promise<{topUpIndex: number; credit: {address: string; derivationPath: string}}> {
    const {network, mnemonic} = unlocked
    const topUpIndex = await this.assetLock.countFundings(walletId, 'identityTopUp')
    const fundingKey = await this.deriveTopUpKey(mnemonic, topUpIndex, network)

    return {
      topUpIndex,
      credit: {
        address: this.p2pkhAddress(fundingKey, network),
        derivationPath: this.topUpKeyPath(topUpIndex, network),
      },
    }
  }

  private p2pkhAddress(key: PrivateKeyWASM, network: Network): string {
    return this.sdkProvider.getPlatformSDK(network).keyPair.p2pkhAddress(key.getPublicKey().bytes(), network)
  }

  private async unlock(walletId: string, password: string): Promise<Unlocked> {
    const wallet = await this.walletDAO.getWalletById(walletId)
    if (wallet == null) {
      throw new Error('Wallet not found')
    }

    let mnemonic: string
    try {
      mnemonic = decryptMnemonic(wallet.encryptedMnemonic, password)
    } catch {
      throw new Error('Invalid wallet password')
    }

    const seed = this.sdkProvider.getPlatformSDK(wallet.network).keyPair.mnemonicToSeed(mnemonic)
    return {network: wallet.network, mnemonic, seed}
  }
}