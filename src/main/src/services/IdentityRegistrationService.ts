import {PrivateKeyWASM} from 'dash-platform-sdk/types.js'
import {KeyPairController} from 'dash-platform-sdk/src/keyPair/index.js'
import {WalletDAO} from '../database/WalletDAO'
import {IdentityDAO} from '../database/IdentityDAO'
import {AssetLockFundingState} from '../types/AssetLockFunding'
import {Network} from '../types'
import {AssetLockService} from './AssetLockService'
import {PlatformWorkerService} from './PlatformWorkerService'
import {unlockWallet, zeroSeed} from '../utils/walletSeed'
import {identityPath} from '../utils/identityKeys'
import {COIN_TYPE, IDENTITY_SCAN_LIMIT} from '../constants'
import {AssetLockFundingRow, AcquiredAssetLock} from '../types/AssetLock'
import {UnlockedWallet} from '../types/UnlockedWallet'

export {IDENTITY_KEY_DEFINITIONS} from '../constants'


// Owns identity registration and top-up funded from L1: derives the funding
// keys, drives an asset lock through AssetLockService, and settles the proof
// into the matching platform worker operation.
export class IdentityRegistrationService {
  // Derivation only — a DashPlatformSDK would build a gRPC pool and fetch the
  // evonode list to do local maths.
  private readonly keyPair = new KeyPairController()

  constructor(
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
  async deriveRegistrationKey(seed: Uint8Array, identityIndex: number, network: Network): Promise<PrivateKeyWASM> {
    return this.deriveFundingKey(seed, this.registrationKeyPath(identityIndex, network), network)
  }

  async deriveTopUpKey(seed: Uint8Array, index: number, network: Network): Promise<PrivateKeyWASM> {
    return this.deriveFundingKey(seed, this.topUpKeyPath(index, network), network)
  }

  private async deriveFundingKey(seed: Uint8Array, path: string, network: Network): Promise<PrivateKeyWASM> {
    const hdKey = this.keyPair.seedToHdKey(seed, network)
    const {privateKey} = await this.keyPair.derivePath(hdKey, path)
    if (privateKey == null) {
      throw new Error(`Could not derive identity funding key at ${path} from wallet hd key`)
    }
    return PrivateKeyWASM.fromBytes(privateKey, network)
  }

  // First index at/after startIndex whose auth key #0 is not already registered
  // on Platform — skips indices taken by the same seed used elsewhere.
  async findNextIdentityIndex(seed: Uint8Array, startIndex: number, network: Network): Promise<number> {
    const {nextFreeIndex} = await this.platform.request('identityScan', network, {
      seed,
      startIndex,
      gapLimit: 1,
      scanLimit: IDENTITY_SCAN_LIMIT,
    })
    return nextFreeIndex
  }

  async startIdentityCreate(walletId: string, amountDuffs: bigint, password: string): Promise<AssetLockFundingState> {
    const unlocked = await unlockWallet(this.walletDAO, walletId, password)
    try {
      const {identityIndex, credit} = await this.prepareRegistration(walletId, unlocked)

      const state = await this.assetLock.begin(walletId, 'identity', '', amountDuffs)
      return this.run(state, unlocked, async () => {
        const acquired = await this.assetLock.acquire(state, {
          walletId, kind: 'identity', destination: '', amountDuffs, seed: unlocked.seed, credit, identityIndex,
        })
        await this.settleCreate(walletId, unlocked, state, acquired, identityIndex)
      })
    } catch (error) {
      zeroSeed(unlocked)
      throw error
    }
  }

  async startIdentityTopUp(walletId: string, identityId: string, amountDuffs: bigint, password: string): Promise<AssetLockFundingState> {
    if (identityId.trim().length === 0) {
      throw new Error('Identity identifier is required')
    }
    const unlocked = await unlockWallet(this.walletDAO, walletId, password)
    try {
      const {topUpIndex, credit} = await this.prepareTopUp(walletId, unlocked)

      const state = await this.assetLock.begin(walletId, 'identityTopUp', identityId, amountDuffs)
      return this.run(state, unlocked, async () => {
        const acquired = await this.assetLock.acquire(state, {
          walletId, kind: 'identityTopUp', destination: identityId, amountDuffs, seed: unlocked.seed,
          credit, identityIndex: topUpIndex,
        })
        await this.settleTopUp(unlocked, state, acquired)
      })
    } catch (error) {
      zeroSeed(unlocked)
      throw error
    }
  }

  // Resumes a funding whose L1 lock already landed. Both identity kinds route
  // here; the row says which.
  async resume(walletId: string, row: AssetLockFundingRow, password: string): Promise<AssetLockFundingState> {
    const unlocked = await unlockWallet(this.walletDAO, walletId, password)
    try {
      if (row.identityIndex == null) {
        throw new Error('Funding record is missing the identity index')
      }
      const identityIndex = row.identityIndex

      const state = this.assetLock.resume(walletId, row)
      return this.run(state, unlocked, async () => {
        const acquired = await this.assetLock.reacquire(state, row)
        if (row.kind === 'identityTopUp') {
          await this.settleTopUp(unlocked, state, acquired)
        } else {
          await this.settleCreate(walletId, unlocked, state, acquired, identityIndex)
        }
      })
    } catch (error) {
      zeroSeed(unlocked)
      throw error
    }
  }

  // The job runs on past the method that started it, so it holds the seed and
  // zeroes it however it settles.
  private run(state: AssetLockFundingState, unlocked: UnlockedWallet, work: () => Promise<void>): AssetLockFundingState {
    void work()
      .catch(error => this.assetLock.fail(state, error))
      .finally(() => zeroSeed(unlocked))
    return state
  }

  private async settleCreate(
    walletId: string,
    unlocked: UnlockedWallet,
    state: AssetLockFundingState,
    {row, proof}: AcquiredAssetLock,
    identityIndex: number,
  ): Promise<void> {
    await this.assetLock.markBroadcastingSt(state, row.txid)

    const {stHash, identifier} = await this.platform.request('identityCreateFromAssetLock', unlocked.wallet.network, {
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
        derivationPath: identityPath(unlocked.wallet.network, identityIndex),
      }, row.txid)
    }

    state.identityIdentifier = identifier
    await this.assetLock.done(state, row.txid, stHash)
  }

  private async settleTopUp(unlocked: UnlockedWallet, state: AssetLockFundingState, {row, proof}: AcquiredAssetLock): Promise<void> {
    await this.assetLock.markBroadcastingSt(state, row.txid)

    const {stHash} = await this.platform.request('identityTopUpFromAssetLock', unlocked.wallet.network, {
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

  private async prepareRegistration(walletId: string, unlocked: UnlockedWallet): Promise<{identityIndex: number; credit: {address: string; derivationPath: string}}> {
    const {wallet: {network}, seed} = unlocked
    const localIdentities = await this.identityDAO.getIdentitiesByWalletId(walletId)
    const startIndex = localIdentities.reduce((max, identity) => Math.max(max, identity.identityIndex + 1), 0)
    const identityIndex = await this.findNextIdentityIndex(seed, startIndex, network)

    const registrationKey = await this.deriveRegistrationKey(seed, identityIndex, network)

    return {
      identityIndex,
      credit: {
        address: this.keyPair.p2pkhAddress(registrationKey.getPublicKey().bytes(), network),
        derivationPath: this.registrationKeyPath(identityIndex, network),
      },
    }
  }

  private async prepareTopUp(walletId: string, unlocked: UnlockedWallet): Promise<{topUpIndex: number; credit: {address: string; derivationPath: string}}> {
    const {wallet: {network}, seed} = unlocked
    const topUpIndex = await this.assetLock.countFundings(walletId, 'identityTopUp')
    const fundingKey = await this.deriveTopUpKey(seed, topUpIndex, network)

    return {
      topUpIndex,
      credit: {
        address: this.keyPair.p2pkhAddress(fundingKey.getPublicKey().bytes(), network),
        derivationPath: this.topUpKeyPath(topUpIndex, network),
      },
    }
  }

}