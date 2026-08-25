import {KeyPairController} from 'dash-platform-sdk/src/keyPair/index.js'
import {WalletDAO} from '../../database/WalletDAO'
import {AssetLockService} from './AssetLockService'
import {PlatformWorkerService} from './PlatformWorkerService'
import {ShieldedService} from './ShieldedService'
import {IdentityDAO} from '../../database/IdentityDAO'
import {AssetLockFundingState} from '../../types/AssetLockFunding'
import {Network} from '../../types/Network'
import {Wallet} from '../../types/Wallet'
import {Identity} from '../../types/Identity'
import {PlatformAddressEntry} from '../../types/PlatformAddress'
import {PlatformSendResult} from '../../types/PlatformSendResult'
import {IdentityCreateResult} from '../../types/IdentityCreateResult'
import {ShieldResult} from '../../types/ShieldResult'
import {unlockWallet, zeroSeed} from '../../utils/walletSeed'
import {
  CREDITS_PER_DUFF,
  MAX_DISCOVERY_BATCHES,
  MAX_RECIPIENTS,
  MIN_OUTPUT_CREDITS,
  PLATFORM_ACCOUNT,
  PLATFORM_ADDRESS_LOOKAHEAD,
} from '../../constants'
import {identityPath} from '../../utils/identityKeys'
import {requireWallet} from '../../utils/requireWallet'
import {selectPlatformSource, toAddressInput} from '../../utils/platformTransfer'
import {lockedDuffsFor} from '../../utils/assetLockTx'
import {coreFeePerByte} from '../../utils/coreFeeRate'
import {Preferences} from '../../preferences'
import {AcquiredAssetLock, AssetLockFundingRow} from '../../types/AssetLock'
import {FeeService} from '../wallet/FeeService'


// Platform (L2) addresses follow DIP-17: m/9'/coinType'/17'/account'/0'/index.
// The account-level xpub is persisted per wallet so the address list derives
// publicly (no password); spends derive the index key from the seed.
//
// This class owns the wallet side only — unlocking, address derivation for
// display, input selection, fee policy and DAO writes. Every key derivation
// for signing, transition build, broadcast and wait is a platform worker
// request; no state transition is built on the main event loop.
export class PlatformAddressService {
  private walletDAO: WalletDAO
  private identityDAO: IdentityDAO
  private assetLock: AssetLockService
  private platform: PlatformWorkerService
  private shielded: ShieldedService
  private fee: FeeService
  private preferences: Preferences
  private keyPair = new KeyPairController()

  constructor(
    walletDAO: WalletDAO,
    identityDAO: IdentityDAO,
    assetLock: AssetLockService,
    platform: PlatformWorkerService,
    shielded: ShieldedService,
    fee: FeeService,
    preferences: Preferences,
  ) {
    this.walletDAO = walletDAO
    this.identityDAO = identityDAO
    this.assetLock = assetLock
    this.platform = platform
    this.shielded = shielded
    this.fee = fee
    this.preferences = preferences
  }

  // Up to MAX_DISCOVERY_BATCHES sequential worker round trips, on a channel the
  // renderer polls — the same guard as WalletService.discoveryInflight.
  private windowInflight = new Map<string, Promise<void>>()

  private extendPlatformWindowOnce(walletId: string, xpub: string, network: Network): Promise<void> {
    const existing = this.windowInflight.get(walletId)
    if (existing) return existing

    const run = this.extendPlatformWindow(walletId, xpub, network)
      .finally(() => this.windowInflight.delete(walletId))
    this.windowInflight.set(walletId, run)
    return run
  }

  async getPlatformAddresses(walletId: string): Promise<PlatformAddressEntry[]> {
    const wallet = await requireWallet(this.walletDAO, walletId)
    if (wallet.platformXpub == null) return []

    await this.extendPlatformWindowOnce(walletId, wallet.platformXpub, wallet.network)

    const candidates = await this.fee.loadCandidates(wallet)
    return candidates.map(candidate => ({
      platformAddress: candidate.platformAddress,
      balanceCredits: candidate.balanceCredits,
      nonce: candidate.nonce,
    }))
  }

  async addPlatformAddress(walletId: string): Promise<PlatformAddressEntry[]> {
    const wallet = await requireWallet(this.walletDAO, walletId)
    if (wallet.platformXpub == null) {
      throw new Error('Platform addresses are not derived yet')
    }

    const count = await this.walletDAO.getPlatformAddressCount(walletId)
    await this.walletDAO.setPlatformAddressCount(walletId, count + 1)

    return this.getPlatformAddresses(walletId)
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

    const {wallet, seed} = await this.unlock(walletId, password)
    const network = wallet.network

    const candidates = await this.fee.loadCandidates(wallet)
    const feeCredits = await this.fee.requireFee(walletId, 'addressFundsTransfer', {
      amountCredits, recipient: toPlatformAddress, sourceAddress: fromPlatformAddress || null,
    })
    const source = selectPlatformSource(candidates, amountCredits, feeCredits, fromPlatformAddress || undefined)

    const {stHash} = await this.platform.request('addressTransfer', network, {
      seed,
      input: toAddressInput(source, amountCredits),
      recipient: toPlatformAddress,
      amountCredits,
    })

    return {
      stHash,
      amountCredits,
      feeCredits,
      fromAddress: source.platformAddress,
      toAddress: toPlatformAddress,
    }
  }

  async sendIdentityCreditsToAddresses(
    walletId: string,
    identityIdentifier: string,
    recipients: Array<{address: string; amountCredits: bigint}>,
    password: string,
  ): Promise<PlatformSendResult> {
    if (recipients.length === 0 || recipients.length > MAX_RECIPIENTS) {
      throw new Error(`Recipient count must be between 1 and ${MAX_RECIPIENTS}`)
    }
    for (const recipient of recipients) {
      if (recipient.amountCredits < MIN_OUTPUT_CREDITS) {
        throw new Error(`Minimum amount per recipient is ${MIN_OUTPUT_CREDITS.toString()} credits`)
      }
    }

    const {wallet, seed} = await this.unlock(walletId, password)
    const network = wallet.network
    const identity = await this.requireIdentity(walletId, identityIdentifier)

    const totalCredits = recipients.reduce((sum, recipient) => sum + recipient.amountCredits, 0n)
    const feeCredits = await this.fee.requireFee(walletId, 'identityToAddress', {
      amountCredits: recipients[0].amountCredits,
      recipient: recipients.map(entry => entry.address),
      identityId: identityIdentifier,
    })
    await this.requireIdentityBalance(network, identityIdentifier, totalCredits + feeCredits, 'transfer')

    const {stHash} = await this.platform.request('identityCreditsToAddresses', network, {
      seed,
      identifier: identityIdentifier,
      identityIndex: identity.identityIndex,
      recipients,
    })

    return {
      stHash,
      amountCredits: totalCredits,
      feeCredits,
      fromAddress: identityIdentifier,
      toAddress: recipients[0].address,
    }
  }

  async transferIdentityCredits(
    walletId: string,
    fromIdentityIdentifier: string,
    toIdentityIdentifier: string,
    amountCredits: bigint,
    password: string,
  ): Promise<PlatformSendResult> {
    if (amountCredits <= 0n) {
      throw new Error('Transfer amount must be greater than zero')
    }
    if (toIdentityIdentifier === fromIdentityIdentifier) {
      throw new Error('Recipient identity must be different from the source identity')
    }

    const {wallet, seed} = await this.unlock(walletId, password)
    const network = wallet.network
    const identity = await this.requireIdentity(walletId, fromIdentityIdentifier)

    const feeCredits = await this.fee.requireFee(walletId, 'identityToIdentity', {
      amountCredits, recipient: toIdentityIdentifier, identityId: fromIdentityIdentifier,
    })
    await this.requireIdentityBalance(network, fromIdentityIdentifier, amountCredits + feeCredits, 'transfer')

    const {stHash} = await this.platform.request('identityCreditTransfer', network, {
      seed,
      identifier: fromIdentityIdentifier,
      identityIndex: identity.identityIndex,
      recipientIdentifier: toIdentityIdentifier,
      amountCredits,
    })

    return {
      stHash,
      amountCredits,
      feeCredits,
      fromAddress: fromIdentityIdentifier,
      toAddress: toIdentityIdentifier,
    }
  }

  async createIdentityFromAddresses(
    walletId: string,
    fromPlatformAddress: string | null,
    amountCredits: bigint,
    password: string,
  ): Promise<IdentityCreateResult> {
    if (amountCredits < MIN_OUTPUT_CREDITS) {
      throw new Error(`Minimum identity funding is ${MIN_OUTPUT_CREDITS.toString()} credits`)
    }

    const {wallet, seed} = await this.unlock(walletId, password)
    const network = wallet.network

    const existing = await this.identityDAO.getIdentitiesByWalletId(walletId)
    const identityIndex = existing.reduce((max, identity) => Math.max(max, identity.identityIndex), -1) + 1

    const {plan, error} = await this.fee.planInputs(wallet, 'identityCreate', {
      amountCredits, recipient: '', sourceAddress: fromPlatformAddress,
    })
    if (plan === null) throw new Error(error)

    const {stHash, identifier} = await this.platform.request('identityCreateFromAddresses', network, {
      seed,
      identityIndex,
      inputs: plan.inputs.map(({candidate, credits}) => toAddressInput(candidate, credits)),
    })

    await this.identityDAO.insertIdentities([{
      walletId,
      identityIndex,
      derivationPath: identityPath(network, identityIndex),
      identifier,
    }])

    return {
      identifier,
      identityIndex,
      stHash,
      amountCredits: amountCredits,
      feeCredits: plan.feeCredits,
      fromAddress: plan.inputs[0].candidate.platformAddress,
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

    const {wallet, seed} = await this.unlock(walletId, password)
    const network = wallet.network

    const {exists} = await this.platform.request('identityExists', network, {identifier: identityId})
    if (!exists) throw new Error('Identity not found on Platform')

    const {plan, error} = await this.fee.planInputs(wallet, 'identityTopUp', {
      amountCredits, recipient: identityId, sourceAddress: fromPlatformAddress,
    })
    if (plan === null) throw new Error(error)

    const {stHash} = await this.platform.request('identityTopUpFromAddresses', network, {
      seed,
      identifier: identityId,
      inputs: plan.inputs.map(({candidate, credits}) => toAddressInput(candidate, credits)),
    })

    return {
      stHash,
      amountCredits: amountCredits,
      feeCredits: plan.feeCredits,
      fromAddress: plan.inputs[0].candidate.platformAddress,
      toAddress: identityId,
    }
  }

  async withdrawPlatformToCore(
    walletId: string,
    fromPlatformAddress: string | null,
    toCoreAddress: string,
    amountCredits: bigint,
    password: string,
  ): Promise<PlatformSendResult> {
    if (amountCredits <= 0n) {
      throw new Error('Withdrawal amount must be greater than zero')
    }

    const {wallet, seed} = await this.unlock(walletId, password)
    const network = wallet.network

    const {plan, error} = await this.fee.planInputs(wallet, 'addressWithdrawal', {
      amountCredits, recipient: toCoreAddress, sourceAddress: fromPlatformAddress,
    })
    if (plan === null) throw new Error(error)

    const {stHash} = await this.platform.request('addressWithdrawal', network, {
      seed,
      inputs: plan.inputs.map(({candidate, credits}) => toAddressInput(candidate, credits)),
      coreAddress: toCoreAddress,
      coreFeePerByte: coreFeePerByte(this.preferences.general.coreFeeMultiplier),
    })

    return {
      stHash,
      amountCredits: amountCredits,
      feeCredits: plan.feeCredits,
      fromAddress: plan.inputs[0].candidate.platformAddress,
      toAddress: toCoreAddress,
    }
  }

  async withdrawIdentityToCore(
    walletId: string,
    identityIdentifier: string,
    toCoreAddress: string,
    amountCredits: bigint,
    password: string,
  ): Promise<PlatformSendResult> {
    if (amountCredits <= 0n) {
      throw new Error('Withdrawal amount must be greater than zero')
    }

    const {wallet, seed} = await this.unlock(walletId, password)
    const network = wallet.network
    const identity = await this.requireIdentity(walletId, identityIdentifier)

    const feeCredits = await this.fee.requireFee(walletId, 'identityWithdrawal', {
      amountCredits, recipient: toCoreAddress, identityId: identityIdentifier,
    })
    await this.requireIdentityBalance(network, identityIdentifier, amountCredits + feeCredits, 'withdrawal')

    const {stHash} = await this.platform.request('identityWithdrawal', network, {
      seed,
      identifier: identityIdentifier,
      identityIndex: identity.identityIndex,
      amountCredits,
      coreAddress: toCoreAddress,
      coreFeePerByte: coreFeePerByte(this.preferences.general.coreFeeMultiplier),
    })

    return {
      stHash,
      amountCredits,
      feeCredits,
      fromAddress: identityIdentifier,
      toAddress: toCoreAddress,
    }
  }

  async shieldToPool(
    walletId: string,
    fromPlatformAddress: string,
    toShieldedAddress: string,
    amountCredits: bigint,
    password: string,
  ): Promise<ShieldResult> {
    if (amountCredits <= 0n) {
      throw new Error('Shield amount must be greater than zero')
    }
    if (toShieldedAddress.length === 0) {
      throw new Error('Shielded recipient address is required')
    }

    const {wallet, seed} = await this.unlock(walletId, password)
    const network = wallet.network

    const candidates = await this.fee.loadCandidates(wallet)
    const feeCredits = await this.fee.requireFee(walletId, 'shield', {
      amountCredits, recipient: toShieldedAddress, sourceAddress: fromPlatformAddress || null,
    })
    const source = selectPlatformSource(candidates, amountCredits, feeCredits, fromPlatformAddress || undefined)

    const {stHash} = await this.platform.request('shield', network, {
      seed,
      source: {
        platformAddress: source.platformAddress,
        nonce: source.nonce,
        balanceCredits: source.balanceCredits,
        index: source.index,
      },
      recipient: toShieldedAddress,
      amountCredits,
    })

    void this.shielded.refreshNotes(walletId, network, seed)

    return {
      stHash,
      amountCredits: amountCredits,
      fromAddress: source.platformAddress,
    }
  }

  // Locks L1 coins and credits them to one of this wallet's platform addresses.
  // amountDuffs is what arrives, so the lock also carries the funding
  // transition's fee.
  async startFundingFromL1(walletId: string, toPlatformAddress: string, amountDuffs: bigint, password: string): Promise<AssetLockFundingState> {
    const unlocked = await this.unlock(walletId, password)
    const {wallet, seed} = unlocked

    try {
      const feeCredits = await this.fee.requireFee(walletId, 'assetLockFunding', {
        amountCredits: amountDuffs * CREDITS_PER_DUFF,
        recipient: toPlatformAddress,
      })
      const lockDuffs = lockedDuffsFor(amountDuffs, feeCredits)

      const state = await this.assetLock.begin(walletId, 'address', toPlatformAddress, lockDuffs)
      return this.runFunding(state, unlocked, async () => {
        const acquired = await this.assetLock.acquire(state, {
          walletId, kind: 'address', destination: toPlatformAddress, amountDuffs: lockDuffs, seed,
        })
        await this.settleFunding(seed, wallet.network, state, acquired)
      })
    } catch (error) {
      zeroSeed(unlocked)
      throw error
    }
  }

  async resumeFundingFromL1(walletId: string, row: AssetLockFundingRow, password: string): Promise<AssetLockFundingState> {
    const unlocked = await this.unlock(walletId, password)
    const {wallet, seed} = unlocked

    const state = this.assetLock.resume(walletId, row)
    return this.runFunding(state, unlocked, async () => {
      const acquired = await this.assetLock.reacquire(state, row)
      await this.settleFunding(seed, wallet.network, state, acquired)
    })
  }

  // The job runs on past the method that started it, so it holds the seed and
  // zeroes it however it settles.
  private runFunding(state: AssetLockFundingState, unlocked: {seed: Uint8Array}, work: () => Promise<void>): AssetLockFundingState {
    void work()
      .catch(error => this.assetLock.fail(state, error))
      .finally(() => zeroSeed(unlocked))
    return state
  }

  private async settleFunding(
    seed: Uint8Array,
    network: Network,
    state: AssetLockFundingState,
    {row, proof}: AcquiredAssetLock,
  ): Promise<void> {
    await this.assetLock.markBroadcastingSt(state, row)

    const {stHash} = await this.platform.request('addressFundingFromAssetLock', network, {
      seed,
      txid: row.txid,
      outputIndex: row.outputIndex,
      assetLockProof: proof,
      creditDerivationPath: row.creditDerivationPath,
      recipient: row.toPlatformAddress,
    })

    await this.assetLock.done(state, row, stHash)
  }


  private async requireIdentity(walletId: string, identifier: string): Promise<Identity> {
    const identities = await this.identityDAO.getIdentitiesByWalletId(walletId)
    const identity = identities.find(entry => entry.identifier === identifier)
    if (identity == null) {
      throw new Error('Identity not found in this wallet')
    }
    return identity
  }

  private async requireIdentityBalance(network: Network, identifier: string, needed: bigint, action: string): Promise<void> {
    const {credits} = await this.platform.request('identityBalance', network, {identifier})
    if (credits < needed) {
      throw new Error(`Identity has insufficient credits for this ${action} plus fee`)
    }
  }

  // Decrypts the mnemonic, derives the seed, and backfills the persisted
  // DIP-17 account xpub for wallets created before the column existed.
  private async unlock(walletId: string, password: string): Promise<{wallet: Wallet; seed: Uint8Array}> {
    const {wallet, seed} = await unlockWallet(this.walletDAO, walletId, password)
    if (wallet.platformXpub != null) return {wallet, seed}

    const platformXpub = await this.keyPair.derivePlatformAccountXpub(seed, wallet.network, PLATFORM_ACCOUNT)
    await this.walletDAO.setPlatformXpub(walletId, platformXpub)
    return {wallet: {...wallet, platformXpub}, seed}
  }

  private async extendPlatformWindow(walletId: string, xpub: string, network: Network): Promise<void> {
    const stored = await this.walletDAO.getPlatformAddressCount(walletId)
    const windowEnd = Math.max(PLATFORM_ADDRESS_LOOKAHEAD, stored)
    let probeStart = windowEnd
    let lastUsed = -1

    for (let batch = 0; batch < MAX_DISCOVERY_BATCHES; batch++) {
      const addresses: string[] = []
      for (let index = probeStart; index < probeStart + PLATFORM_ADDRESS_LOOKAHEAD; index++) {
        addresses.push(this.keyPair.derivePlatformAddressFromXpub(xpub, network, index).toBech32m(network))
      }
      const {infos} = await this.platform.request('addressInfos', network, {addresses})
      const byAddress = new Map(infos.map(info => [info.address, info]))

      let usedInBatch = -1
      addresses.forEach((address, i) => {
        const info = byAddress.get(address)
        if (info != null && (info.balance > 0n || info.nonce > 0)) {
          usedInBatch = probeStart + i
        }
      })
      if (usedInBatch === -1) break

      lastUsed = usedInBatch
      probeStart += PLATFORM_ADDRESS_LOOKAHEAD
    }

    if (lastUsed >= windowEnd) {
      await this.walletDAO.setPlatformAddressCount(walletId, lastUsed + 1)
    }
  }
}
