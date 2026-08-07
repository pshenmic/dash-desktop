import {KeyPairController} from 'dash-platform-sdk/src/keyPair/index.js'
import {WalletDAO} from '../database/WalletDAO'
import {AssetLockService} from './AssetLockService'
import {PlatformWorkerService} from './PlatformWorkerService'
import {ShieldedService} from './ShieldedService'
import {IdentityDAO} from '../database/IdentityDAO'
import {AssetLockFundingState} from '../types/AssetLockFunding'
import {Network} from '../types'
import {Wallet} from '../types/Wallet'
import {Identity} from '../types/Identity'
import {PlatformAddressEntry} from '../types/PlatformAddress'
import {PlatformSendResult} from '../types/PlatformSendResult'
import {IdentityCreateResult} from '../types/IdentityCreateResult'
import {ShieldResult} from '../types/ShieldResult'
import {unlockWallet, zeroSeed} from '../utils/walletSeed'
import {
  IDENTITY_CREATE_KEY_COUNT,
  IDENTITY_CREDIT_TRANSFER_FEE_CREDITS,
  MAX_DISCOVERY_BATCHES,
  MAX_RECIPIENTS,
  MIN_OUTPUT_CREDITS,
  PLATFORM_ACCOUNT,
  PLATFORM_ADDRESS_LOOKAHEAD,
  TRANSFER_FEE_CREDITS,
  WITHDRAWAL_FEE_CREDITS,
} from '../constants'
import {identityPath} from '../utils/identityKeys'
import {AddressInput, FeeQuery, FeeQuote} from '../../platform/types/messages'
import {selectPlatformSource, selectPlatformInputsWithFee, topUpFeeCredits, identityTransferFeeCredits, identityCreateFeeCredits} from '../utils/platformTransfer'
import {AcquiredAssetLock, AssetLockFundingRow} from '../types/AssetLock'
import {PlatformSourceCandidate} from '../types/PlatformTransfer'
const toInput = (candidate: PlatformSourceCandidate, credits: bigint): AddressInput => ({
  platformAddress: candidate.platformAddress,
  index: candidate.index,
  nonce: candidate.nonce,
  credits,
})

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
  private keyPair = new KeyPairController()

  constructor(
    walletDAO: WalletDAO,
    identityDAO: IdentityDAO,
    assetLock: AssetLockService,
    platform: PlatformWorkerService,
    shielded: ShieldedService,
  ) {
    this.walletDAO = walletDAO
    this.identityDAO = identityDAO
    this.assetLock = assetLock
    this.platform = platform
    this.shielded = shielded
  }

  async getPlatformAddresses(walletId: string): Promise<PlatformAddressEntry[]> {
    const wallet = await this.requireWallet(walletId)
    if (wallet.platformXpub == null) return []

    await this.extendPlatformWindow(walletId, wallet.platformXpub, wallet.network)

    const candidates = await this.loadPlatformCandidates(walletId, wallet.platformXpub, wallet.network)
    return candidates.map(candidate => ({
      platformAddress: candidate.platformAddress,
      balanceCredits: candidate.balanceCredits,
      nonce: candidate.nonce,
    }))
  }

  async addPlatformAddress(walletId: string): Promise<PlatformAddressEntry[]> {
    const wallet = await this.requireWallet(walletId)
    if (wallet.platformXpub == null) {
      throw new Error('Platform addresses are not derived yet')
    }

    const count = await this.walletDAO.getPlatformAddressCount(walletId)
    await this.walletDAO.setPlatformAddressCount(walletId, count + 1)

    return this.getPlatformAddresses(walletId)
  }

  async estimateTransitionFee(network: Network, query: FeeQuery): Promise<FeeQuote> {
    return this.platform.request('transitionFee', network, {query})
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

    const {wallet, seed, xpub} = await this.unlock(walletId, password)
    const network = wallet.network

    const candidates = await this.loadPlatformCandidates(walletId, xpub, network)
    const {totalFeeCredits} = await this.estimateTransitionFee(network, {
      kind: 'addressTransfer',
      inputCount: 1,
      recipients: [toPlatformAddress],
    })
    const source = selectPlatformSource(candidates, amountCredits, totalFeeCredits, fromPlatformAddress || undefined)

    const {stHash} = await this.platform.request('addressTransfer', network, {
      seed,
      input: toInput(source, amountCredits),
      recipient: toPlatformAddress,
      amountCredits,
    })

    return {
      stHash,
      amountCredits,
      feeCredits: totalFeeCredits,
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
    const feeCredits = identityTransferFeeCredits(recipients.length)
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

    await this.requireIdentityBalance(
      network,
      fromIdentityIdentifier,
      amountCredits + IDENTITY_CREDIT_TRANSFER_FEE_CREDITS,
      'transfer',
    )

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
      feeCredits: IDENTITY_CREDIT_TRANSFER_FEE_CREDITS,
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

    const {wallet, seed, xpub} = await this.unlock(walletId, password)
    const network = wallet.network

    const existing = await this.identityDAO.getIdentitiesByWalletId(walletId)
    const identityIndex = existing.reduce((max, identity) => Math.max(max, identity.identityIndex), -1) + 1

    const candidates = await this.loadPlatformCandidates(walletId, xpub, network)
    const plan = selectPlatformInputsWithFee(
      candidates,
      amountCredits,
      () => identityCreateFeeCredits(IDENTITY_CREATE_KEY_COUNT),
      fromPlatformAddress ?? undefined,
    )

    const {stHash, identifier} = await this.platform.request('identityCreateFromAddresses', network, {
      seed,
      identityIndex,
      inputs: plan.inputs.map(({candidate, credits}) => toInput(candidate, credits)),
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

    const {wallet, seed, xpub} = await this.unlock(walletId, password)
    const network = wallet.network

    const {exists} = await this.platform.request('identityExists', network, {identifier: identityId})
    if (!exists) throw new Error('Identity not found on Platform')

    const candidates = await this.loadPlatformCandidates(walletId, xpub, network)
    const plan = selectPlatformInputsWithFee(candidates, amountCredits, topUpFeeCredits, fromPlatformAddress ?? undefined)

    const {stHash} = await this.platform.request('identityTopUpFromAddresses', network, {
      seed,
      identifier: identityId,
      inputs: plan.inputs.map(({candidate, credits}) => toInput(candidate, credits)),
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

    const {wallet, seed, xpub} = await this.unlock(walletId, password)
    const network = wallet.network

    const candidates = await this.loadPlatformCandidates(walletId, xpub, network)
    const plan = selectPlatformInputsWithFee(
      candidates,
      amountCredits,
      () => WITHDRAWAL_FEE_CREDITS,
      fromPlatformAddress ?? undefined,
    )

    const {stHash} = await this.platform.request('addressWithdrawal', network, {
      seed,
      inputs: plan.inputs.map(({candidate, credits}) => toInput(candidate, credits)),
      coreAddress: toCoreAddress,
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

    await this.requireIdentityBalance(
      network,
      identityIdentifier,
      amountCredits + WITHDRAWAL_FEE_CREDITS,
      'withdrawal',
    )

    const {stHash} = await this.platform.request('identityWithdrawal', network, {
      seed,
      identifier: identityIdentifier,
      identityIndex: identity.identityIndex,
      amountCredits,
      coreAddress: toCoreAddress,
    })

    return {
      stHash,
      amountCredits,
      feeCredits: WITHDRAWAL_FEE_CREDITS,
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

    const {wallet, seed, xpub} = await this.unlock(walletId, password)
    const network = wallet.network

    const candidates = await this.loadPlatformCandidates(walletId, xpub, network)
    const source = selectPlatformSource(candidates, amountCredits, TRANSFER_FEE_CREDITS, fromPlatformAddress || undefined)

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
  async startFundingFromL1(walletId: string, toPlatformAddress: string, amountDuffs: bigint, password: string): Promise<AssetLockFundingState> {
    const unlocked = await this.unlock(walletId, password)
    const {wallet, seed} = unlocked

    try {
      const state = await this.assetLock.begin(walletId, 'address', toPlatformAddress, amountDuffs)
      return this.runFunding(state, unlocked, async () => {
        const acquired = await this.assetLock.acquire(state, {
          walletId, kind: 'address', destination: toPlatformAddress, amountDuffs, seed,
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
    await this.assetLock.markBroadcastingSt(state, row.txid)

    const {stHash} = await this.platform.request('addressFundingFromAssetLock', network, {
      seed,
      txid: row.txid,
      outputIndex: row.outputIndex,
      assetLockProof: proof,
      creditDerivationPath: row.creditDerivationPath,
      recipient: row.toPlatformAddress,
    })

    await this.assetLock.done(state, row.txid, stHash)
  }

  private async requireWallet(walletId: string): Promise<Wallet> {
    const wallet = await this.walletDAO.getWalletById(walletId)
    if (wallet == null) {
      throw new Error('Wallet not found')
    }
    return wallet
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
  private async unlock(walletId: string, password: string): Promise<{wallet: Wallet; seed: Uint8Array; xpub: string}> {
    const {wallet, seed} = await unlockWallet(this.walletDAO, walletId, password)

    let xpub = wallet.platformXpub
    if (xpub == null) {
      xpub = await this.keyPair.derivePlatformAccountXpub(seed, wallet.network, PLATFORM_ACCOUNT)
      await this.walletDAO.setPlatformXpub(walletId, xpub)
    }

    return {wallet, seed, xpub}
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

  private async loadPlatformCandidates(walletId: string, xpub: string, network: Network): Promise<PlatformSourceCandidate[]> {
    const count = Math.max(PLATFORM_ADDRESS_LOOKAHEAD, await this.walletDAO.getPlatformAddressCount(walletId))
    const owned = Array.from({length: count}, (_, index) => ({
      platformAddress: this.keyPair.derivePlatformAddressFromXpub(xpub, network, index).toBech32m(network),
      index,
    }))

    const {infos} = await this.platform.request('addressInfos', network, {
      addresses: owned.map(entry => entry.platformAddress),
    })

    const byAddress = new Map(infos.map(info => [info.address, info]))
    return owned.map(entry => {
      const info = byAddress.get(entry.platformAddress)
      return {
        ...entry,
        balanceCredits: info?.balance ?? 0n,
        nonce: info?.nonce ?? 0,
      }
    })
  }
}
