import {
  AssetLockProofWASM,
  AddressFundingFromAssetLockTransitionWASM,
  AddressFundsFeeStrategyStepWASM,
  OutputAddressNullableCreditsWASM,
  PrivateKeyWASM,
} from 'dash-platform-sdk/types.js'
import {OrchardAddressWASM, OutPointWASM} from 'pshenmic-dpp'
import {Transaction as SDKTransaction} from 'dash-core-sdk'
import {WalletDAO} from '../database/WalletDAO'
import {IdentityDAO} from '../database/IdentityDAO'
import {AssetLockDAO, AssetLockFundingKind, AssetLockFundingRow} from '../database/AssetLockDAO'
import {Network} from '../types'
import {Wallet} from '../types/Wallet'
import {WalletService} from './WalletService'
import {ShieldedService} from './ShieldedService'
import {SdkProvider} from './SdkProvider'
import {IdentityRegistrationService} from './IdentityRegistrationService'
import {decryptMnemonic} from '../utils'
import {ASSET_LOCK_CREDIT_OUTPUT_INDEX, shieldAmountFromLockedDuffs} from '../utils/assetLockTx'

export type AssetLockFundingPhase =
  | 'idle'
  | 'resumable'
  | 'building'
  | 'broadcastingL1'
  | 'waitingChainLock'
  | 'broadcastingST'
  | 'done'
  | 'error'

export interface AssetLockFundingState {
  phase: AssetLockFundingPhase
  kind: AssetLockFundingKind
  txid: string | null
  txHeight: number | null
  chainLockedHeight: number | null
  stHash: string | null
  toPlatformAddress: string | null
  identityIdentifier: string | null
  amountDuffs: string | null
  error: string | null
}

const POLL_INTERVAL_MS = 15_000
const MAX_POLL_ATTEMPTS = 240
const SHIELDED_ACCOUNT = 0
const PLATFORM_ACCOUNT = 0
const ALREADY_IN_CHAIN_MESSAGE = 'state transition already in chain'

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export class AssetLockService {
  private walletDAO: WalletDAO
  private identityDAO: IdentityDAO
  private assetLockDAO: AssetLockDAO
  private walletService: WalletService
  private shieldedService: ShieldedService
  private sdkProvider: SdkProvider
  private identityRegistrationService: IdentityRegistrationService
  private states = new Map<string, AssetLockFundingState>()

  constructor(walletDAO: WalletDAO, identityDAO: IdentityDAO, assetLockDAO: AssetLockDAO, walletService: WalletService, shieldedService: ShieldedService, sdkProvider: SdkProvider, identityRegistrationService: IdentityRegistrationService) {
    this.walletDAO = walletDAO
    this.identityDAO = identityDAO
    this.assetLockDAO = assetLockDAO
    this.walletService = walletService
    this.shieldedService = shieldedService
    this.sdkProvider = sdkProvider
    this.identityRegistrationService = identityRegistrationService
  }

  private idleState(): AssetLockFundingState {
    return {phase: 'idle', kind: 'address', txid: null, txHeight: null, chainLockedHeight: null, stHash: null, toPlatformAddress: null, identityIdentifier: null, amountDuffs: null, error: null}
  }

  private isActive(state: AssetLockFundingState | undefined): boolean {
    return state != null && (state.phase === 'building' || state.phase === 'broadcastingL1' || state.phase === 'waitingChainLock' || state.phase === 'broadcastingST')
  }

  async getState(walletId: string): Promise<AssetLockFundingState> {
    const current = this.states.get(walletId)
    if (current != null && current.phase !== 'idle') {
      return current
    }
    const row = await this.assetLockDAO.getActiveFunding(walletId)
    if (row != null) {
      return {
        ...this.idleState(),
        phase: 'resumable',
        kind: row.kind,
        txid: row.txid,
        toPlatformAddress: row.toPlatformAddress,
        amountDuffs: row.amountDuffs,
      }
    }
    return current ?? this.idleState()
  }

  async startFunding(walletId: string, toPlatformAddress: string, amountDuffs: bigint, password: string, kind: AssetLockFundingKind = 'address'): Promise<AssetLockFundingState> {
    const current = this.states.get(walletId)
    if (this.isActive(current)) {
      return current!
    }
    const pending = await this.assetLockDAO.getActiveFunding(walletId)
    if (pending != null) {
      throw new Error('A previous funding is still in progress — resume it first')
    }

    let destination = toPlatformAddress
    if (kind === 'identity' || kind === 'identityTopUp') {
      if (kind === 'identity') {
        destination = ''
      } else if (destination.trim().length === 0) {
        throw new Error('Identity identifier is required')
      }
      const wallet = await this.walletDAO.getWalletById(walletId)
      if (wallet == null) {
        throw new Error('Wallet not found')
      }
      try {
        decryptMnemonic(wallet.encryptedMnemonic, password)
      } catch {
        throw new Error('Invalid wallet password')
      }
    }
    if (kind === 'shielded') {
      shieldAmountFromLockedDuffs(amountDuffs)
      const wallet = await this.walletDAO.getWalletById(walletId)
      if (wallet == null) {
        throw new Error('Wallet not found')
      }
      if (toPlatformAddress.length > 0) {
        try {
          OrchardAddressWASM.fromBech32m(toPlatformAddress)
        } catch {
          throw new Error('Invalid shielded recipient address')
        }
      } else {
        let mnemonic: string
        try {
          mnemonic = decryptMnemonic(wallet.encryptedMnemonic, password)
        } catch {
          throw new Error('Invalid wallet password')
        }
        const keyPair = this.sdkProvider.getPlatformSDK(wallet.network).keyPair
        const seed = keyPair.mnemonicToSeed(mnemonic)
        destination = keyPair.deriveShieldedAddress(seed, wallet.network, SHIELDED_ACCOUNT).toBech32m(wallet.network)
      }
    }

    const state: AssetLockFundingState = {
      ...this.idleState(),
      phase: 'building',
      kind,
      toPlatformAddress: destination,
      amountDuffs: amountDuffs.toString(),
    }
    this.states.set(walletId, state)
    void this.runNewFunding(walletId, destination, amountDuffs, password, state, kind)
    return state
  }

  async resumeFunding(walletId: string, password: string): Promise<AssetLockFundingState> {
    const current = this.states.get(walletId)
    if (this.isActive(current)) {
      return current!
    }

    const row = await this.assetLockDAO.getActiveFunding(walletId)
    if (row == null) {
      throw new Error('No funding to resume')
    }

    const wallet = await this.walletDAO.getWalletById(walletId)
    if (wallet == null) {
      throw new Error('Wallet not found')
    }
    try {
      decryptMnemonic(wallet.encryptedMnemonic, password)
    } catch {
      throw new Error('Invalid wallet password')
    }

    const state: AssetLockFundingState = {
      ...this.idleState(),
      phase: 'waitingChainLock',
      kind: row.kind,
      txid: row.txid,
      toPlatformAddress: row.toPlatformAddress,
      amountDuffs: row.amountDuffs,
    }
    this.states.set(walletId, state)
    void this.completeFunding(walletId, row, password, state).catch(error => this.failState(state, row.txid, error))
    return state
  }

  private async failState(state: AssetLockFundingState, txid: string | null, error: unknown): Promise<void> {
    state.error = error instanceof Error ? error.message : String(error)
    state.phase = txid != null ? 'resumable' : 'error'
  }

  private async runNewFunding(walletId: string, toPlatformAddress: string, amountDuffs: bigint, password: string, state: AssetLockFundingState, kind: AssetLockFundingKind): Promise<void> {
    let txid: string | null = null
    try {
      let credit: {address: string; derivationPath: string} | undefined
      let identityIndex: number | null = null
      if (kind === 'identity') {
        const prepared = await this.prepareIdentityRegistration(walletId, password)
        credit = prepared.credit
        identityIndex = prepared.identityIndex
      }
      if (kind === 'identityTopUp') {
        const prepared = await this.prepareIdentityTopUp(walletId, password)
        credit = prepared.credit
        identityIndex = prepared.topUpIndex
      }

      state.phase = 'broadcastingL1'
      const broadcasted = await this.walletService.buildAndBroadcastAssetLock(walletId, amountDuffs, password, credit)
      txid = broadcasted.txid
      state.txid = txid

      await this.assetLockDAO.insertFunding({
        walletId,
        txid,
        outputIndex: ASSET_LOCK_CREDIT_OUTPUT_INDEX,
        creditDerivationPath: broadcasted.creditDerivationPath,
        amountDuffs: amountDuffs.toString(),
        toPlatformAddress,
        kind,
        status: 'l1_broadcast',
        identityIndex,
        txHex: broadcasted.tx.hex(),
        createdAt: Math.floor(Date.now() / 1000),
      })

      const row = await this.assetLockDAO.getActiveFunding(walletId)
      if (row == null) {
        throw new Error('Funding record not found after broadcast')
      }

      await this.completeFunding(walletId, row, password, state, {tx: broadcasted.tx, inputAddresses: broadcasted.inputAddresses})
    } catch (error) {
      await this.failState(state, txid, error)
    }
  }

  private async prepareIdentityRegistration(walletId: string, password: string): Promise<{identityIndex: number; credit: {address: string; derivationPath: string}}> {
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

    const localIdentities = await this.identityDAO.getIdentitiesByWalletId(walletId)
    const startIndex = localIdentities.reduce((max, identity) => Math.max(max, identity.identityIndex + 1), 0)
    const identityIndex = await this.identityRegistrationService.findNextIdentityIndex(mnemonic, startIndex, network)

    const registrationKey = await this.identityRegistrationService.deriveRegistrationKey(mnemonic, identityIndex, network)
    const address = this.sdkProvider.getPlatformSDK(network).keyPair.p2pkhAddress(registrationKey.getPublicKey().bytes(), network)

    return {
      identityIndex,
      credit: {address, derivationPath: this.identityRegistrationService.registrationKeyPath(identityIndex, network)},
    }
  }

  private async prepareIdentityTopUp(walletId: string, password: string): Promise<{topUpIndex: number; credit: {address: string; derivationPath: string}}> {
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

    const topUpIndex = await this.assetLockDAO.countFundingsByKind(walletId, 'identityTopUp')
    const fundingKey = await this.identityRegistrationService.deriveTopUpKey(mnemonic, topUpIndex, network)
    const address = this.sdkProvider.getPlatformSDK(network).keyPair.p2pkhAddress(fundingKey.getPublicKey().bytes(), network)

    return {
      topUpIndex,
      credit: {address, derivationPath: this.identityRegistrationService.topUpKeyPath(topUpIndex, network)},
    }
  }

  private async completeFunding(walletId: string, row: AssetLockFundingRow, password: string, state: AssetLockFundingState, live?: {tx: SDKTransaction; inputAddresses: string[]}): Promise<void> {
    const wallet = await this.walletDAO.getWalletById(walletId)
    if (wallet == null) {
      throw new Error('Wallet not found')
    }
    const network = wallet.network
    const sdk = this.sdkProvider.getPlatformSDK(network)

    if (row.kind === 'identity' || row.kind === 'identityTopUp') {
      return this.completeIdentityFunding(wallet, row, password, state, live)
    }

    state.phase = 'waitingChainLock'

    const coreSDK = this.sdkProvider.getCoreSDK(network)

    let txHeight = 0
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS && txHeight <= 0; attempt++) {
      try {
        const dapiTx = await coreSDK.getTransaction(row.txid)
        if (dapiTx.height > 0) {
          txHeight = dapiTx.height
          break
        }
      } catch {}
      await sleep(POLL_INTERVAL_MS)
    }
    if (txHeight <= 0) {
      throw new Error('Timed out waiting for the asset lock transaction to confirm — resume later')
    }
    state.txHeight = txHeight

    let chainLockedHeight = 0
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS && chainLockedHeight < txHeight; attempt++) {
      try {
        const status = await sdk.node.status()
        const height = status.chain?.coreChainLockedHeight
        if (height != null) {
          state.chainLockedHeight = height
          if (height >= txHeight) {
            chainLockedHeight = height
            break
          }
        }
      } catch {}
      await sleep(POLL_INTERVAL_MS)
    }
    if (chainLockedHeight < txHeight) {
      throw new Error('Timed out waiting for a ChainLock covering the asset lock — resume later')
    }

    await this.assetLockDAO.updateStatus(row.txid, 'chainlocked')

    state.phase = 'broadcastingST'

    const decryptedMnemonic = decryptMnemonic(wallet.encryptedMnemonic, password)
    const seed = sdk.keyPair.mnemonicToSeed(decryptedMnemonic)

    const stHash = row.kind === 'shielded'
      ? await this.broadcastShieldSt(row, seed, network, chainLockedHeight)
      : await this.broadcastAddressFundingSt(row, seed, network, chainLockedHeight)

    state.stHash = stHash
    state.phase = 'done'

    await this.assetLockDAO.updateStatus(row.txid, 'done', {stHash})
  }

  private async broadcastAddressFundingSt(row: AssetLockFundingRow, seed: Uint8Array, network: Network, chainLockedHeight: number): Promise<string> {
    const sdk = this.sdkProvider.getPlatformSDK(network)
    const hdKey = sdk.keyPair.seedToHdKey(seed, network)
    const derived = await sdk.keyPair.derivePath(hdKey, row.creditDerivationPath)
    if (!derived.privateKey) {
      throw new Error('Failed to derive the asset lock credit key')
    }
    const creditKey = PrivateKeyWASM.fromBytes(derived.privateKey as Uint8Array, network)

    const proof = AssetLockProofWASM.createChainAssetLockProof(chainLockedHeight, new OutPointWASM(row.txid, row.outputIndex))

    const unsignedSt = sdk.platformAddresses.createStateTransition('addressFundingFromAssetLock', {
      assetLockProof: proof,
      inputs: [],
      feeStrategy: [AddressFundsFeeStrategyStepWASM.ReduceOutput(0)],
      inputWitness: [],
      outputs: [new OutputAddressNullableCreditsWASM(row.toPlatformAddress)],
      userFeeIncrease: 0,
    })

    const transition = AddressFundingFromAssetLockTransitionWASM.fromStateTransition(unsignedSt)
    transition.signature = creditKey.sign(unsignedSt.getSignableBytes())
    const signedSt = transition.toStateTransition()

    await this.assetLockDAO.updateStatus(row.txid, 'st_broadcast')

    await sdk.stateTransitions.broadcast(signedSt)
    await sdk.stateTransitions.waitForStateTransitionResult(signedSt)

    return signedSt.hash(false)
  }

  private async broadcastShieldSt(row: AssetLockFundingRow, seed: Uint8Array, network: Network, chainLockedHeight: number): Promise<string> {
    const surplus = await this.sdkProvider.getPlatformSDK(network).keyPair.derivePlatformAddress(seed, network, PLATFORM_ACCOUNT, 0)

    await this.assetLockDAO.updateStatus(row.txid, 'st_broadcast')

    return this.shieldedService.shieldFromAssetLock(network, seed, {
      txid: row.txid,
      outputIndex: row.outputIndex,
      coreChainLockedHeight: chainLockedHeight,
      creditDerivationPath: row.creditDerivationPath,
      recipient: row.toPlatformAddress,
      shieldAmountCredits: shieldAmountFromLockedDuffs(BigInt(row.amountDuffs)),
      surplusAddress: surplus.toBech32m(network),
    })
  }

  private async completeIdentityFunding(wallet: Wallet, row: AssetLockFundingRow, password: string, state: AssetLockFundingState, live?: {tx: SDKTransaction; inputAddresses: string[]}): Promise<void> {
    const network = wallet.network
    const sdk = this.sdkProvider.getPlatformSDK(network)
    if (row.identityIndex == null) {
      throw new Error('Funding record is missing the identity index')
    }

    let mnemonic: string
    try {
      mnemonic = decryptMnemonic(wallet.encryptedMnemonic, password)
    } catch {
      throw new Error('Invalid wallet password')
    }
    const fundingKey = row.kind === 'identityTopUp'
      ? await this.identityRegistrationService.deriveTopUpKey(mnemonic, row.identityIndex, network)
      : await this.identityRegistrationService.deriveRegistrationKey(mnemonic, row.identityIndex, network)

    state.phase = 'waitingChainLock'

    const tx = live?.tx ?? (row.txHex != null ? SDKTransaction.fromHex(row.txHex) : null)
    if (tx == null) {
      throw new Error('Funding record is missing the asset lock transaction')
    }
    const watchAddresses = live?.inputAddresses ?? [sdk.keyPair.p2pkhAddress(fundingKey.getPublicKey().bytes(), network)]
    const assetLockProof = await this.identityRegistrationService.waitForAssetLockProof(tx, row.txid, watchAddresses, network)

    await this.assetLockDAO.updateStatus(row.txid, 'chainlocked')

    state.phase = 'broadcastingST'

    if (row.kind === 'identityTopUp') {
      const stateTransition = this.identityRegistrationService.buildIdentityTopUpTransition(row.toPlatformAddress, fundingKey, assetLockProof, network)
      const stHash = stateTransition.hash(false)

      await this.assetLockDAO.updateStatus(row.txid, 'st_broadcast')

      let alreadyOnPlatform = false
      try {
        await sdk.stateTransitions.broadcast(stateTransition)
      } catch (e) {
        if (this.isAlreadyInChain(e)) {
          alreadyOnPlatform = true
        } else {
          throw e
        }
      }
      if (!alreadyOnPlatform) {
        await sdk.stateTransitions.waitForStateTransitionResult(stateTransition)
      }

      state.identityIdentifier = row.toPlatformAddress
      state.stHash = stHash
      state.phase = 'done'

      await this.assetLockDAO.updateStatus(row.txid, 'done', {stHash})
      return
    }

    const identityKeys = await this.identityRegistrationService.deriveIdentityKeys(mnemonic, row.identityIndex, network)
    const stateTransition = this.identityRegistrationService.buildIdentityCreateTransition(identityKeys, fundingKey, assetLockProof, network)

    const identifier = stateTransition.getOwnerId()?.base58()
    if (identifier == null || identifier === '') {
      throw new Error('Could not derive identity identifier from state transition')
    }
    const stHash = stateTransition.hash(false)

    // Persist before broadcasting so a crash leaves a recoverable record. Roll
    // back on a non-idempotent broadcast failure so local state never holds a
    // phantom identity. A pre-existing record (a previous attempt) is treated
    // as recovery.
    const coinType = network === 'mainnet' ? 5 : 1
    const existing = await this.identityDAO.getByIdentifier(wallet.walletId, identifier)
    let wasJustCreated = false
    if (existing == null) {
      await this.identityDAO.insertIdentity({
        walletId: wallet.walletId,
        identityIndex: row.identityIndex,
        identifier,
        derivationPath: `m/9'/${coinType}'/0'/0/${row.identityIndex}`,
      }, row.txid)
      wasJustCreated = true
    }

    await this.assetLockDAO.updateStatus(row.txid, 'st_broadcast')

    let alreadyOnPlatform = false
    try {
      await sdk.stateTransitions.broadcast(stateTransition)
    } catch (e) {
      if (this.isAlreadyInChain(e)) {
        alreadyOnPlatform = true
      } else {
        if (wasJustCreated) {
          await this.identityDAO.removeIdentity(wallet.walletId, identifier)
        }
        throw e
      }
    }

    if (!alreadyOnPlatform) {
      await sdk.stateTransitions.waitForStateTransitionResult(stateTransition)
    }

    state.identityIdentifier = identifier
    state.stHash = stHash
    state.phase = 'done'

    await this.assetLockDAO.updateStatus(row.txid, 'done', {stHash})
  }

  private isAlreadyInChain(e: unknown): boolean {
    const message = e instanceof Error ? e.message : String(e ?? '')
    return message.includes(ALREADY_IN_CHAIN_MESSAGE)
  }
}
