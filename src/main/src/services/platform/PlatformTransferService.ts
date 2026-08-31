import {WalletDAO} from '../../database/WalletDAO'
import {AssetLockService} from './AssetLockService'
import {PlatformAddressService} from './PlatformAddressService'
import {PlatformWorkerService} from './PlatformWorkerService'
import {ShieldedService} from './ShieldedService'
import {IdentityDAO} from '../../database/IdentityDAO'
import {AssetLockFundingState} from '../../types/AssetLockFunding'
import {Network} from '../../types/Network'
import {Wallet} from '../../types/Wallet'
import {Identity} from '../../types/Identity'
import {PlatformSendResult} from '../../types/PlatformSendResult'
import {IdentityCreateResult} from '../../types/IdentityCreateResult'
import {ShieldResult} from '../../types/ShieldResult'
import {unlockWallet, zeroSeed} from '../../utils/walletSeed'
import {platformAccountXpub} from '../../utils/platformAddress'
import {CREDITS_PER_DUFF, MAX_RECIPIENTS, MIN_OUTPUT_CREDITS} from '../../constants/credits'
import {identityPath} from '../../utils/identityKeys'
import {selectPlatformSource, toAddressInput} from '../../utils/platformTransfer'
import {lockedDuffsFor} from '../../utils/assetLockTx'
import {coreFeePerByte} from '../../utils/coreFeeRate'
import {Preferences} from '../../preferences'
import {AcquiredAssetLock, AssetLockFundingRow} from '../../types/AssetLock'
import {FeeService} from '../wallet/FeeService'


// Every way credits move on L2: between platform addresses, to and from
// identities, out to L1, into the shielded pool, and in from an L1 asset lock.
// The L1 counterpart is CoreTransactionService.
//
// This class owns the wallet side only — unlocking, input selection, fee policy
// and DAO writes. Which addresses exist and what they hold is
// PlatformAddressService. Every key derivation for signing, transition build,
// broadcast and wait is a platform worker request; no state transition is built
// on the main event loop.
export class PlatformTransferService {
  private walletDAO: WalletDAO
  private identityDAO: IdentityDAO
  private assetLock: AssetLockService
  private addresses: PlatformAddressService
  private platform: PlatformWorkerService
  private shielded: ShieldedService
  private fee: FeeService
  private preferences: Preferences

  constructor(
    walletDAO: WalletDAO,
    identityDAO: IdentityDAO,
    assetLock: AssetLockService,
    addresses: PlatformAddressService,
    platform: PlatformWorkerService,
    shielded: ShieldedService,
    fee: FeeService,
    preferences: Preferences,
  ) {
    this.walletDAO = walletDAO
    this.identityDAO = identityDAO
    this.assetLock = assetLock
    this.addresses = addresses
    this.platform = platform
    this.shielded = shielded
    this.fee = fee
    this.preferences = preferences
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

    const candidates = await this.addresses.loadCandidates(wallet)
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

    const candidates = await this.addresses.loadCandidates(wallet)
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

  // Decrypts the mnemonic, derives the seed, and backfills the persisted DIP-17
  // account xpub for wallets created before the column existed.
  private async unlock(walletId: string, password: string): Promise<{wallet: Wallet; seed: Uint8Array}> {
    const {wallet, seed} = await unlockWallet(this.walletDAO, walletId, password)
    const platformXpub = await platformAccountXpub(this.walletDAO, wallet, seed)
    return {wallet: {...wallet, platformXpub}, seed}
  }
}
