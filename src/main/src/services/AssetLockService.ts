import {
  DashCoreSDK,
  InstantLock,
  Transaction as SDKTransaction,
  utils as coreUtils,
} from 'dash-core-sdk'
import type {ChainAssetLockProofParams, InstantAssetLockProofParams} from 'dash-core-sdk/src/utils.js'
import {WalletDAO} from '../database/WalletDAO'
import {AssetLockDAO} from '../database/AssetLockDAO'
import {AssetLockFundingStatus} from '../enums/AssetLockFundingStatus'
import {AssetLockFundingState} from '../types/AssetLockFunding'
import {Network} from '../types'
import {PlatformWorkerService} from './PlatformWorkerService'
import {AssetLockProofParams} from '../../platform/types/messages'
import {
  AcquireParams,
  AcquiredAssetLock,
  AssetLockFunder,
} from '../types/AssetLock'
import {IDENTITY_LOCK_POLL_INTERVAL_MS, IDENTITY_LOCK_TIMEOUT_MS, ASSET_LOCK_CREDIT_OUTPUT_INDEX} from '../constants'
import {AssetLockFundingKind, AssetLockFundingRow} from '../types/AssetLock'
const coreSDKs = new Map<Network, DashCoreSDK>()

// The constructor starts evonode discovery in the background, so one is kept per
// network — a fresh instance answers its first request against an empty DAPI
// url list.
function coreSDK(network: Network): DashCoreSDK {
  let sdk = coreSDKs.get(network)
  if (sdk == null) {
    sdk = new DashCoreSDK({network})
    coreSDKs.set(network, sdk)
  }
  return sdk
}

// Locks L1 coins and produces the proof that funds a platform state transition.
// Knows nothing about what the proof is spent on — identities, shielded notes
// and platform addresses each own their own settlement and call in here.
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

  countFundings(walletId: string, kind: AssetLockFundingKind): Promise<number> {
    return this.assetLockDAO.countFundingsByKind(walletId, kind)
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
      amountDuffs: amountDuffs.toString(),
    }
    this.states.set(walletId, state)
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
    return state
  }

  // A funding that reached L1 is resumable; one that never did is a dead end.
  fail(state: AssetLockFundingState, error: unknown): void {
    state.error = error instanceof Error ? error.message : String(error)
    state.phase = state.txid != null ? 'resumable' : 'error'
  }

  async markBroadcastingSt(state: AssetLockFundingState, txid: string): Promise<void> {
    state.phase = 'broadcastingST'
    await this.assetLockDAO.updateStatus(txid, AssetLockFundingStatus.StBroadcast)
  }

  async done(state: AssetLockFundingState, txid: string, stHash: string): Promise<void> {
    state.stHash = stHash
    state.phase = 'done'
    await this.assetLockDAO.updateStatus(txid, AssetLockFundingStatus.Done, {stHash})
  }

  // Builds and broadcasts the L1 lock, records it, then waits for the proof.
  async acquire(state: AssetLockFundingState, params: AcquireParams): Promise<AcquiredAssetLock> {
    const {walletId, amountDuffs, seed} = params

    state.phase = 'broadcastingL1'
    const broadcasted = await this.funder.buildAndBroadcastAssetLock(walletId, amountDuffs, seed, params.credit)
    state.txid = broadcasted.txid

    await this.assetLockDAO.insertFunding({
      walletId,
      txid: broadcasted.txid,
      outputIndex: ASSET_LOCK_CREDIT_OUTPUT_INDEX,
      creditDerivationPath: broadcasted.creditDerivationPath,
      amountDuffs: amountDuffs.toString(),
      toPlatformAddress: params.destination,
      kind: params.kind,
      status: AssetLockFundingStatus.L1Broadcast,
      identityIndex: params.identityIndex ?? null,
      txHex: broadcasted.tx.hex(),
      createdAt: Math.floor(Date.now() / 1000),
    })

    const row = await this.assetLockDAO.getActiveFunding(walletId)
    if (row == null) {
      throw new Error('Funding record not found after broadcast')
    }

    const proof = await this.awaitProof(state, row, {tx: broadcasted.tx})
    return {row, proof}
  }

  // Waits for the proof of a funding that was already broadcast, rebuilding the
  // transaction from the stored row.
  async reacquire(state: AssetLockFundingState, row: AssetLockFundingRow): Promise<AcquiredAssetLock> {
    return {row, proof: await this.awaitProof(state, row)}
  }

  private async awaitProof(
    state: AssetLockFundingState,
    row: AssetLockFundingRow,
    live?: {tx: SDKTransaction},
  ): Promise<AssetLockProofParams> {
    if (row.assetLockProof != null) {
      this.applyLockKind(state, row.assetLockProof)
      return row.assetLockProof
    }

    const wallet = await this.walletDAO.getWalletById(row.walletId)
    if (wallet == null) {
      throw new Error('Wallet not found')
    }
    const network = wallet.network

    state.phase = 'waitingChainLock'

    const tx = live?.tx ?? (row.txHex != null ? SDKTransaction.fromHex(row.txHex) : null)
    if (tx == null) {
      throw new Error('Funding record is missing the asset lock transaction')
    }

    const resolved = await this.waitForAssetLockProof(tx, row.txid, network)

    let proof: AssetLockProofParams
    if (resolved.type === 'instantLock') {
      proof = {type: 'instantLock', instantLock: resolved.instantLock, transaction: resolved.transaction}
    } else {
      // The worker rebuilds the outpoint from the row, while the proof carries
      // the txid the SDK read off the transaction. They are the same value in
      // display order — a mismatch means one side is holding wire order, which
      // would otherwise silently produce a proof against the wrong outpoint.
      if (resolved.txid !== row.txid) {
        throw new Error(`Asset lock proof txid ${resolved.txid} does not match the funding record ${row.txid}`)
      }
      proof = {type: 'chainLock', coreChainLockedHeight: resolved.coreChainLockedHeight}
    }

    this.applyLockKind(state, proof)
    await this.assetLockDAO.saveProof(row.txid, proof)
    await this.assetLockDAO.updateStatus(row.txid, AssetLockFundingStatus.ChainLocked)

    return proof
  }

  private applyLockKind(state: AssetLockFundingState, proof: AssetLockProofParams): void {
    state.lockKind = proof.type === 'instantLock' ? 'instant' : 'chain'
    if (proof.type === 'chainLock') {
      state.chainLockedHeight = proof.coreChainLockedHeight
    }
  }

  // Races the instant lock (our own p2p pool) against the chain lock (DAPI
  // polling, because chain-lock events can be missed). First to resolve wins.
  private async waitForAssetLockProof(
    assetLockTx: SDKTransaction,
    txid: string,
    network: Network,
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

    const chainLockRace = async (): Promise<ChainAssetLockProofParams> => {
      const sdk = coreSDK(network)
      const deadline = Date.now() + IDENTITY_LOCK_TIMEOUT_MS

      while (Date.now() < deadline) {
        if (settled) throw new Error('cancelled')

        try {
          const dapiTx = await sdk.getTransaction(txid)

          if (dapiTx.isChainLocked) {
            const requiredHeight = dapiTx.height

            while (Date.now() < deadline) {
              if (settled) throw new Error('cancelled')

              try {
                const {chain} = await this.platform.request('nodeStatus', network, {})
                const latestHeight = chain?.coreChainLockedHeight

                if (latestHeight != null && latestHeight >= requiredHeight) {
                  return coreUtils.createAssetLockProof({
                    transaction: assetLockTx,
                    coreChainLockedHeight: dapiTx.height,
                    outputIndex: ASSET_LOCK_CREDIT_OUTPUT_INDEX,
                  }) as ChainAssetLockProofParams
                }
              } catch {
                // Platform node status unavailable — keep polling until deadline.
              }

              await coreUtils.wait(IDENTITY_LOCK_POLL_INTERVAL_MS)
            }
          }
        } catch {
          // Asset lock tx not yet visible on DAPI — keep polling until deadline.
        }

        await coreUtils.wait(IDENTITY_LOCK_POLL_INTERVAL_MS)
      }

      throw new Error(`Timed out waiting for asset lock proof on transaction ${txid} after ${Math.round(IDENTITY_LOCK_TIMEOUT_MS / 1000)}s`)
    }

    try {
      return await Promise.race([instantLockRace(), chainLockRace()])
    } finally {
      settled = true
    }
  }
}