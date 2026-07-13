import {
  AssetLockProofWASM,
  AddressFundingFromAssetLockTransitionWASM,
  AddressFundsFeeStrategyStepWASM,
  OutputAddressNullableCreditsWASM,
  PrivateKeyWASM,
} from 'dash-platform-sdk/types.js'
import {OrchardAddressWASM, OutPointWASM} from 'pshenmic-dpp'
import {WalletDAO} from '../database/WalletDAO'
import {AssetLockDAO, AssetLockFundingKind, AssetLockFundingRow} from '../database/AssetLockDAO'
import {Network} from '../types'
import {WalletService} from './WalletService'
import {ShieldedService} from './ShieldedService'
import {SdkProvider} from './SdkProvider'
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
  amountDuffs: string | null
  error: string | null
}

const POLL_INTERVAL_MS = 15_000
const MAX_POLL_ATTEMPTS = 240
const SHIELDED_ACCOUNT = 0
const PLATFORM_ACCOUNT = 0

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export class AssetLockService {
  private walletDAO: WalletDAO
  private assetLockDAO: AssetLockDAO
  private walletService: WalletService
  private shieldedService: ShieldedService
  private sdkProvider: SdkProvider
  private states = new Map<string, AssetLockFundingState>()

  constructor(walletDAO: WalletDAO, assetLockDAO: AssetLockDAO, walletService: WalletService, shieldedService: ShieldedService, sdkProvider: SdkProvider) {
    this.walletDAO = walletDAO
    this.assetLockDAO = assetLockDAO
    this.walletService = walletService
    this.shieldedService = shieldedService
    this.sdkProvider = sdkProvider
  }

  private idleState(): AssetLockFundingState {
    return {phase: 'idle', kind: 'address', txid: null, txHeight: null, chainLockedHeight: null, stHash: null, toPlatformAddress: null, amountDuffs: null, error: null}
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
      state.phase = 'broadcastingL1'
      const broadcasted = await this.walletService.buildAndBroadcastAssetLock(walletId, amountDuffs, password)
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
        createdAt: Math.floor(Date.now() / 1000),
      })

      const row = await this.assetLockDAO.getActiveFunding(walletId)
      if (row == null) {
        throw new Error('Funding record not found after broadcast')
      }

      await this.completeFunding(walletId, row, password, state)
    } catch (error) {
      await this.failState(state, txid, error)
    }
  }

  private async completeFunding(walletId: string, row: AssetLockFundingRow, password: string, state: AssetLockFundingState): Promise<void> {
    const wallet = await this.walletDAO.getWalletById(walletId)
    if (wallet == null) {
      throw new Error('Wallet not found')
    }
    const network = wallet.network
    const sdk = this.sdkProvider.getPlatformSDK(network)

    state.phase = 'waitingChainLock'

    const provider = this.walletService.getProvider(walletId, network)

    let txHeight = 0
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS && txHeight <= 0; attempt++) {
      try {
        const tx = await provider.getTransactionByHash(row.txid)
        if (tx.blockHeight > 0) {
          txHeight = tx.blockHeight
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
}
