import {
  InstantLock,
  Transaction as SDKTransaction,
  utils as coreUtils,
} from 'dash-core-sdk'
import type {ChainAssetLockProofParams, InstantAssetLockProofParams} from 'dash-core-sdk/src/utils.js'
import {WalletDAO} from '../../database/WalletDAO'
import {AssetLockDAO} from '../../database/AssetLockDAO'
import {AssetLockFundingStatus} from '../../enums/AssetLockFundingStatus'
import {AssetLockFundingState} from '../../types/AssetLockFunding'
import {Network} from '../../types/Network'
import {PlatformWorkerService} from './PlatformWorkerService'
import {AssetLockProofParams} from '../../../platform/types/messages'
import {
  AcquireParams,
  AcquiredAssetLock,
  AssetLockFunder,
  AssetLockFundingKind,
  AssetLockFundingRow,
} from '../../types/AssetLock'
import {CHAIN_LOCK_BACKSTOP_MS, IDENTITY_LOCK_TIMEOUT_MS} from '../../constants/chain'
import {ASSET_LOCK_CREDIT_OUTPUT_INDEX, ASSET_LOCK_DISMISSED_ERROR} from '../../constants/credits'
import {isStaleInstantLockProof} from '../../utils/sdkErrors'
import {requireWallet} from '../../utils/requireWallet'
import {coreSDK} from '../../utils/coreSDK'
import {Logger} from '../../utils/logger'

const log = new Logger('assetLock')

// Locks L1 coins and produces the proof that funds a platform state transition.
// Deliberately knows nothing about what the proof is spent on — identities,
// shielded notes and platform addresses each own their settlement.
export class AssetLockService {
  private walletDAO: WalletDAO
  private assetLockDAO: AssetLockDAO
  private funder: AssetLockFunder
  private platform: PlatformWorkerService
  private states = new Map<string, AssetLockFundingState>()

  constructor(
    walletDAO: WalletDAO,
    assetLockDAO: AssetLockDAO,
    funder: AssetLockFunder,
    platform: PlatformWorkerService,
  ) {
    this.walletDAO = walletDAO
    this.assetLockDAO = assetLockDAO
    this.funder = funder
    this.platform = platform
  }

  private idleState(): AssetLockFundingState {
    return {phase: 'idle', kind: 'address', txid: null, txHeight: null, chainLockedHeight: null, lockKind: null, stHash: null, toPlatformAddress: null, identityIdentifier: null, amountDuffs: null, error: null}
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

  getActive(walletId: string): AssetLockFundingState | null {
    const current = this.states.get(walletId)
    return this.isActive(current) ? current! : null
  }

  getResumable(walletId: string): Promise<AssetLockFundingRow | null> {
    return this.assetLockDAO.getActiveFunding(walletId)
  }

  async dismiss(walletId: string): Promise<AssetLockFundingState> {
    const row = await this.assetLockDAO.getActiveFunding(walletId)
    if (this.getActive(walletId) != null) {
      throw new Error('Cannot dismiss funding while it is running')
    }
    if (row != null) {
      await this.assetLockDAO.updateStatus(walletId, row.txid, AssetLockFundingStatus.Error, {error: ASSET_LOCK_DISMISSED_ERROR})
    }

    const state = this.idleState()
    this.states.set(walletId, state)
    return state
  }
  // Installs the job state for a new funding. Throws when one is already
  // running or a previous one is still resumable.
  async begin(walletId: string, kind: AssetLockFundingKind, destination: string, amountDuffs: bigint): Promise<AssetLockFundingState> {
    const pending = await this.assetLockDAO.getActiveFunding(walletId)
    if (pending != null) {
      throw new Error('A previous funding is still in progress — resume it first')
    }

    const state: AssetLockFundingState = {
      ...this.idleState(),
      phase: 'building',
      kind,
      toPlatformAddress: destination,
      amountDuffs,
    }
    this.states.set(walletId, state)
    log.info(`${walletId}: begin ${kind} ${amountDuffs} duffs -> ${destination}`)
    return state
  }

  // Re-installs the job state for a stored funding so a resumed flow reports
  // progress the same way a fresh one does.
  resume(walletId: string, row: AssetLockFundingRow): AssetLockFundingState {
    const state: AssetLockFundingState = {
      ...this.idleState(),
      phase: 'waitingChainLock',
      kind: row.kind,
      txid: row.txid,
      toPlatformAddress: row.toPlatformAddress,
      amountDuffs: row.amountDuffs,
    }
    this.states.set(walletId, state)
    log.info(`${row.txid}: resuming ${row.kind} from ${row.status}`)
    return state
  }

  // A funding that reached L1 is resumable; one that never did is a dead end.
  fail(state: AssetLockFundingState, error: unknown): void {
    state.error = error instanceof Error ? error.message : String(error)
    state.phase = state.txid != null ? 'resumable' : 'error'
    log.error(`${state.txid ?? state.kind}: ${state.phase} — ${state.error}`)
  }

  async markBroadcastingSt(state: AssetLockFundingState, row: AssetLockFundingRow): Promise<void> {
    state.phase = 'broadcastingST'
    log.info(`${row.txid}: broadcasting state transition`)
    await this.assetLockDAO.updateStatus(row.walletId, row.txid, AssetLockFundingStatus.StBroadcast)
  }

  // A stale instant lock is rejected for good, so the retry has to go via the
  // chain lock.
  async broadcastWithProof<T>(
    state: AssetLockFundingState,
    row: AssetLockFundingRow,
    proof: AssetLockProofParams,
    broadcast: (proof: AssetLockProofParams) => Promise<T>,
  ): Promise<T> {
    try {
      return await broadcast(proof)
    } catch (error) {
      if (proof.type !== 'instantLock' || !isStaleInstantLockProof(error)) throw error

      log.warn(`${row.txid}: instant lock proof rejected as stale — waiting for a chain lock instead`)
      await this.assetLockDAO.clearProof(row.walletId, row.txid)
      await this.assetLockDAO.updateStatus(row.walletId, row.txid, AssetLockFundingStatus.L1Broadcast)
      const chainProof = await this.awaitProof(state, row, {chainLockOnly: true})

      await this.markBroadcastingSt(state, row)
      return await broadcast(chainProof)
    }
  }

  async done(state: AssetLockFundingState, row: AssetLockFundingRow, stHash: string): Promise<void> {
    state.stHash = stHash
    state.phase = 'done'
    log.info(`${row.txid}: done st=${stHash}`)
    await this.assetLockDAO.updateStatus(row.walletId, row.txid, AssetLockFundingStatus.Done, {stHash})
  }

  // The funding row is written before the broadcast: coins committed with no
  // row on disk cannot be resumed.
  async acquire(state: AssetLockFundingState, params: AcquireParams): Promise<AcquiredAssetLock> {
    const {walletId, amountDuffs, seed} = params

    state.phase = 'broadcastingL1'
    const built = await this.funder.buildAssetLock(walletId, amountDuffs, seed, params.credit, params.source)
    state.txid = built.txid

    await this.assetLockDAO.insertFunding({
      walletId,
      txid: built.txid,
      outputIndex: ASSET_LOCK_CREDIT_OUTPUT_INDEX,
      creditDerivationPath: built.creditDerivationPath,
      amountDuffs,
      toPlatformAddress: params.destination,
      kind: params.kind,
      status: AssetLockFundingStatus.L1Broadcast,
      identityIndex: params.identityIndex ?? null,
      txHex: built.tx.hex(),
      createdAt: Math.floor(Date.now() / 1000),
    })

    // Losing the response does not prove peers missed the transaction: the
    // transport can exit after delivery but before reporting propagation.
    await this.funder.broadcastAssetLock(built.tx.hex())
    log.info(`${built.txid}: L1 lock broadcast, credit ${built.creditAddress}`)

    const row = await this.assetLockDAO.getActiveFunding(walletId)
    if (row == null) {
      throw new Error('Funding record not found after broadcast')
    }

    const proof = await this.awaitProof(state, row, {live: built.tx})
    return {row, proof}
  }

  // A resume always proves by chain lock: the instant lock may be stale by now.
  async reacquire(state: AssetLockFundingState, row: AssetLockFundingRow): Promise<AcquiredAssetLock> {
    const network = (await requireWallet(this.walletDAO, row.walletId)).network
    const dapiTx = await coreSDK(network).getTransaction(row.txid).catch(() => null)
    const {chain} = await this.platform.request('nodeStatus', network, {})

    // Platform validates the proof against its own chainlocked core height.
    if (dapiTx == null || dapiTx.confirmations < 1 || (chain?.coreChainLockedHeight ?? 0) < dapiTx.height) {
      throw new Error('The asset lock transaction is not chainlocked yet - please wait a few minutes and resume again')
    }

    const proof: AssetLockProofParams = {type: 'chainLock', coreChainLockedHeight: dapiTx.height}
    this.applyLockKind(state, proof)
    log.info(`${row.txid}: resumed by chain lock at h=${dapiTx.height}`)
    await this.assetLockDAO.saveProof(row.walletId, row.txid, proof)
    await this.assetLockDAO.updateStatus(row.walletId, row.txid, AssetLockFundingStatus.ChainLocked)
    return {row, proof}
  }

  private async awaitProof(
    state: AssetLockFundingState,
    row: AssetLockFundingRow,
    options?: {live?: SDKTransaction; chainLockOnly?: boolean},
  ): Promise<AssetLockProofParams> {
    const network = (await requireWallet(this.walletDAO, row.walletId)).network

    state.phase = 'waitingChainLock'

    const tx = options?.live ?? (row.txHex != null ? SDKTransaction.fromHex(row.txHex) : null)
    if (tx == null) {
      throw new Error('Funding record is missing the asset lock transaction')
    }

    const resolved = await this.waitForAssetLockProof(tx, row.txid, network, options?.chainLockOnly === true)

    let proof: AssetLockProofParams
    if (resolved.type === 'instantLock') {
      proof = {type: 'instantLock', instantLock: resolved.instantLock, transaction: resolved.transaction}
    } else {
      // The worker rebuilds the outpoint from the row, the proof carries the
      // txid the SDK read off the transaction. Equal in display order — a
      // mismatch means one side holds wire order, which would silently prove
      // against the wrong outpoint.
      if (resolved.txid !== row.txid) {
        throw new Error(`Asset lock proof txid ${resolved.txid} does not match the funding record ${row.txid}`)
      }
      proof = {type: 'chainLock', coreChainLockedHeight: resolved.coreChainLockedHeight}
    }

    this.applyLockKind(state, proof)
    log.info(`${row.txid}: settled by ${proof.type}`)
    await this.assetLockDAO.saveProof(row.walletId, row.txid, proof)
    await this.assetLockDAO.updateStatus(row.walletId, row.txid, AssetLockFundingStatus.ChainLocked)

    return proof
  }

  private applyLockKind(state: AssetLockFundingState, proof: AssetLockProofParams): void {
    state.lockKind = proof.type === 'instantLock' ? 'instant' : 'chain'
    if (proof.type === 'chainLock') {
      state.chainLockedHeight = proof.coreChainLockedHeight
    }
  }

  // Races the instant lock against the chain lock, first to resolve wins. Both
  // are driven by our own lock pool; DAPI is still asked which block holds the
  // transaction, because a clsig carries a height and no outpoint.
  private async waitForAssetLockProof(
    assetLockTx: SDKTransaction,
    txid: string,
    network: Network,
    chainLockOnly: boolean,
  ): Promise<InstantAssetLockProofParams | ChainAssetLockProofParams> {
    let settled = false

    const instantLockRace = async (): Promise<InstantAssetLockProofParams> => {
      const hex = await this.funder.waitForInstantLock(txid, IDENTITY_LOCK_TIMEOUT_MS)
      if (settled) throw new Error('cancelled')
      if (!hex) {
        // No p2p islock within the window — let chainLockRace settle it.
        return await new Promise<InstantAssetLockProofParams>(() => {})
      }
      const instantLock = InstantLock.fromHex(hex)
      return coreUtils.createAssetLockProof({
        transaction: assetLockTx,
        instantLock,
        outputIndex: ASSET_LOCK_CREDIT_OUTPUT_INDEX,
      }) as InstantAssetLockProofParams
    }

    // Our own lock pool sees every clsig, so a chainlock is the only event that
    // can change either answer below. Between two of them, re-asking DAPI can
    // only return what it already returned.
    const chainLockRace = async (): Promise<ChainAssetLockProofParams> => {
      const sdk = coreSDK(network)
      const deadline = Date.now() + IDENTITY_LOCK_TIMEOUT_MS

      while (Date.now() < deadline) {
        if (settled) throw new Error('cancelled')

        // Re-read every round rather than pinning the first answer, which would
        // outlive the transaction being reorged out of the block it names.
        const dapiTx = await sdk.getTransaction(txid).catch(() => null)

        if (dapiTx?.isChainLocked === true) {
          // Platform validates the proof against its own core node, so its view
          // of the chainlocked tip is the one that has to have reached the tx.
          const platformHeight = await this.platform.request('nodeStatus', network, {})
            .then(({chain}) => chain?.coreChainLockedHeight ?? 0)
            .catch(err => {
              log.warn(`${txid}: platform node status unavailable:`, err)
              return 0
            })

          if (platformHeight >= dapiTx.height) {
            log.info(`${txid}: chainlocked at h=${dapiTx.height}, platform at h=${platformHeight} — building proof`)
            return coreUtils.createAssetLockProof({
              transaction: assetLockTx,
              coreChainLockedHeight: dapiTx.height,
              outputIndex: ASSET_LOCK_CREDIT_OUTPUT_INDEX,
            }) as ChainAssetLockProofParams
          }
        }

        const seen = this.funder.chainlockedHeight(network)
        log.info(`${txid}: not chainlocked yet (tx ${dapiTx == null ? 'not on DAPI' : `h=${dapiTx.height}`}) — waiting past h=${seen}`)
        const remaining = Math.max(0, deadline - Date.now())
        await this.funder.waitForChainLock(network, seen + 1, Math.min(remaining, CHAIN_LOCK_BACKSTOP_MS))
      }

      throw new Error(`Timed out waiting for asset lock proof on transaction ${txid} after ${Math.round(IDENTITY_LOCK_TIMEOUT_MS / 1000)}s`)
    }

    try {
      return await Promise.race(chainLockOnly ? [chainLockRace()] : [instantLockRace(), chainLockRace()])
    } finally {
      settled = true
    }
  }
}
