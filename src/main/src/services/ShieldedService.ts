import { KeyPairController } from 'dash-platform-sdk/src/keyPair/index.js'
import { OrchardAddressWASM } from 'pshenmic-dpp'
import { IdentityRegistrationService } from './IdentityRegistrationService'
import { Network } from '../types'
import { WalletDAO } from '../database/WalletDAO'
import { IdentityDAO } from '../database/IdentityDAO'
import { ShieldedNoteDAO } from '../database/ShieldedNoteDAO'
import { ShieldedPoolDAO } from '../database/ShieldedPoolDAO'
import { ShieldedAddressDAO } from '../database/ShieldedAddressDAO'
import { AssetLockFundingRow } from '../database/AssetLockDAO'
import { AssetLockFundingState } from '../types/AssetLockFunding'
import { AcquiredAssetLock, AssetLockService } from './AssetLockService'
import { decryptMnemonic } from '../utils'
import { PLATFORM_ACCOUNT, SHIELDED_ACCOUNT, SHIELDED_NOTES_FETCH_BATCH } from '../constants'
import { identityPath } from '../utils/identityKeys'
import { shieldAmountFromLockedDuffs } from '../utils/assetLockTx'
import { PlatformWorkerService } from './PlatformWorkerService'
import {
  AssetLockProofParams,
  EncryptedNotePayload,
  PlatformPayload,
  PlatformPhase,
  ProverState,
  ShieldSource,
  SpendKind,
} from '../../platform/types/messages'

export type ShieldedProverState = ProverState
export type ShieldedSyncPhase = 'idle' | 'syncing' | 'recovering' | 'done' | 'error'
export type ShieldedSpendPhase = 'idle' | 'syncing' | 'proving' | 'broadcasting' | 'done' | 'error'

export type { AssetLockProofParams, ShieldSource }

export interface ShieldedStatus {
  prover: ShieldedProverState
  ready: boolean
  error: string | null
}

export interface ShieldedPoolInfo {
  poolState: string | null
  notesCount: string | null
}

export interface ShieldedNotesInfo {
  undecodedCount: number
}

export interface ShieldedNoteInfo {
  index: number
  amount: string
  spent: boolean
  address: string
}

export interface ShieldedSyncState {
  phase: ShieldedSyncPhase
  fetched: number
  total: number
  balance: string | null
  notes: ShieldedNoteInfo[]
  error: string | null
  syncedAt: number | null
}

export interface ShieldedSpendState {
  phase: ShieldedSpendPhase
  fetched: number
  total: number
  stHash: string | null
  identityId: string | null
  error: string | null
}

type SpendPayload = PlatformPayload<'spend'>

function syncPhase(phase: PlatformPhase): ShieldedSyncPhase | null {
  return phase === 'recovering' ? 'recovering' : null
}

function spendPhase(phase: PlatformPhase): ShieldedSpendPhase | null {
  switch (phase) {
    case 'proving': return 'proving'
    case 'broadcasting':
    case 'awaitingResult': return 'broadcasting'
    default: return null
  }
}

// Bound on how far addAddress derives forward while skipping used
// (already-received-on) diversified addresses.
const NEW_ADDRESS_LOOKAHEAD_LIMIT = 100

// Wallet-domain layer over the shielded operations of the platform worker.
// Owns unlocking, address derivation for display, per-wallet sync/spend state
// and the note DAOs; everything CPU-bound or network-bound is a
// PlatformWorkerService request.
export class ShieldedService {
  private walletDAO: WalletDAO
  private identityDAO: IdentityDAO
  private shieldedNoteDAO: ShieldedNoteDAO
  private shieldedPoolDAO: ShieldedPoolDAO
  private shieldedAddressDAO: ShieldedAddressDAO
  private identityRegistrationService: IdentityRegistrationService
  private platform: PlatformWorkerService
  private assetLock: AssetLockService
  private syncStates = new Map<string, ShieldedSyncState>()
  private spendStates = new Map<string, ShieldedSpendState>()
  private addresses = new Map<string, string[]>()
  private noteFetches = new Map<Network, Promise<void>>()
  // Derivation only. A DashPlatformSDK would build a gRPC pool and fetch the
  // evonode list to do local maths.
  private keyPair = new KeyPairController()

  constructor(walletDAO: WalletDAO, identityDAO: IdentityDAO, shieldedNoteDAO: ShieldedNoteDAO, shieldedPoolDAO: ShieldedPoolDAO, shieldedAddressDAO: ShieldedAddressDAO, identityRegistrationService: IdentityRegistrationService, platform: PlatformWorkerService, assetLock: AssetLockService) {
    this.walletDAO = walletDAO
    this.identityDAO = identityDAO
    this.shieldedNoteDAO = shieldedNoteDAO
    this.shieldedPoolDAO = shieldedPoolDAO
    this.shieldedAddressDAO = shieldedAddressDAO
    this.identityRegistrationService = identityRegistrationService
    this.platform = platform
    this.assetLock = assetLock
  }

  private async persistCreatedIdentity(context: {walletId: string; identityIndex: number; network: Network}, identifier: string): Promise<void> {
    const existing = await this.identityDAO.getByIdentifier(context.walletId, identifier)
    if (existing != null) return
    await this.identityDAO.insertIdentity({
      walletId: context.walletId,
      identityIndex: context.identityIndex,
      identifier,
      derivationPath: identityPath(context.network, context.identityIndex),
    }, null)
  }

  private failed(state: {phase: string; error: string | null}, e: unknown): void {
    state.phase = 'error'
    state.error = e instanceof Error ? e.message : String(e)
  }

  getStatus(): ShieldedStatus {
    const {prover, proverError} = this.platform.getStatus()
    return {prover, ready: prover === 'ready', error: proverError}
  }

  async getAddress(walletId: string, password?: string): Promise<string | null> {
    const list = await this.getAddresses(walletId, password)
    return list != null && list.length > 0 ? list[0] : null
  }

  async getAddresses(walletId: string, password?: string): Promise<string[] | null> {
    const cached = this.addresses.get(walletId)
    if (cached != null) return cached

    const persisted = await this.shieldedAddressDAO.getAddresses(walletId)
    if (persisted.length > 0) {
      this.addresses.set(walletId, persisted)
      return persisted
    }

    if (password == null || password.length === 0) return null

    const {seed, network} = await this.unlock(walletId, password)
    return this.cacheAddresses(walletId, seed, network)
  }

  // Grows the derived list so its newest address is unused: diversified
  // addresses share one viewing key, so a synced wallet can hold notes on
  // indexes never shown yet — those are skipped (but become visible).
  async addAddress(walletId: string, password: string): Promise<string[]> {
    const {seed, network} = await this.unlock(walletId, password)
    const used = await this.shieldedNoteDAO.getUsedAddresses(walletId)
    let count = await this.walletDAO.getShieldedAddressCount(walletId)
    const limit = count + NEW_ADDRESS_LOOKAHEAD_LIMIT
    let address: string
    do {
      count++
      address = this.keyPair.deriveShieldedAddress(seed, network, SHIELDED_ACCOUNT, count - 1).toBech32m(network)
    } while (used.has(address) && count < limit)
    await this.walletDAO.setShieldedAddressCount(walletId, count)
    return this.cacheAddresses(walletId, seed, network)
  }

  // All diversified addresses of the account share one incoming viewing key,
  // so sync/spend in the worker are unaffected by how many exist — only
  // derivation for display happens here.
  private async cacheAddresses(walletId: string, seed: Uint8Array, network: Network): Promise<string[]> {
    const count = await this.walletDAO.getShieldedAddressCount(walletId)
    const list: string[] = []
    for (let i = 0; i < count; i++) {
      list.push(this.keyPair.deriveShieldedAddress(seed, network, SHIELDED_ACCOUNT, i).toBech32m(network))
    }
    this.addresses.set(walletId, list)
    await this.shieldedAddressDAO.saveAddresses(walletId, list)
    return list
  }

  private async unlock(walletId: string, password: string): Promise<{seed: Uint8Array; network: Network; mnemonic: string}> {
    const wallet = await this.walletDAO.getWalletById(walletId)
    if (wallet == null) throw new Error('Wallet not found')

    let mnemonic: string
    try {
      mnemonic = decryptMnemonic(wallet.encryptedMnemonic, password)
    } catch {
      throw new Error('Invalid wallet password')
    }
    const seed = this.keyPair.mnemonicToSeed(mnemonic)

    if (wallet.platformXpub == null) {
      const xpub = await this.keyPair.derivePlatformAccountXpub(seed, wallet.network, PLATFORM_ACCOUNT)
      await this.walletDAO.setPlatformXpub(walletId, xpub)
    }

    return {seed, network: wallet.network, mnemonic}
  }

  async getPoolInfo(network: Network): Promise<ShieldedPoolInfo> {
    const {poolState, notesCount} = await this.platform.request('poolInfo', network, {})
    return {
      poolState: poolState != null ? poolState.toString() : null,
      notesCount: notesCount != null ? notesCount.toString() : null
    }
  }

  // Downloads the ciphertexts of pool notes not stored yet. Needs no password:
  // the payloads are network state, trial-decrypted later when the user unlocks
  // a sync. Deduped per network, so wallets sharing one share the download.
  checkForNewNotes(network: Network, onProgress?: (fetched: number, total: number) => void): Promise<void> {
    const inFlight = this.noteFetches.get(network)
    if (inFlight != null) return inFlight
    const fetch = this.fetchNewNotes(network, onProgress)
      .finally(() => this.noteFetches.delete(network))
    this.noteFetches.set(network, fetch)
    return fetch
  }

  // Keeps the pool warm for a wallet that has synced before. It cannot detect
  // incoming notes on its own — that needs trial-decryption, so a password —
  // which is why a wallet that has never opened the feature polls nothing.
  async prefetchNotes(walletId: string, network: Network): Promise<void> {
    const decoded = await this.walletDAO.getShieldedDecodedCount(walletId)
    if (decoded === 0) return
    await this.checkForNewNotes(network)
  }

  private async fetchNewNotes(network: Network, onProgress?: (fetched: number, total: number) => void): Promise<void> {
    const {count} = await this.platform.request('notesCount', network, {})
    const total = count != null ? Number(count) : 0
    const stored = await this.shieldedPoolDAO.getCount(network)
    if (stored >= total) return

    const missing = total - stored
    let cursor = Math.floor(stored / SHIELDED_NOTES_FETCH_BATCH) * SHIELDED_NOTES_FETCH_BATCH
    let downloaded = 0
    onProgress?.(0, missing)
    while (cursor < total) {
      const batchSize = Math.min(SHIELDED_NOTES_FETCH_BATCH, total - cursor)
      const {notes} = await this.platform.request('encryptedNotes', network, {startIndex: cursor, count: batchSize})
      if (notes.length === 0) break
      await this.shieldedPoolDAO.saveEncryptedNotes(network, notes)
      downloaded += notes.length
      cursor += notes.length
      onProgress?.(Math.min(downloaded, missing), missing)
      if (notes.length < batchSize) break
    }

    // A short pool witnesses against an expired anchor, so callers must not
    // proceed on a partial download.
    if (await this.shieldedPoolDAO.getCount(network) < total) {
      throw new Error('Could not download new shielded notes. Check your connection and try again.')
    }
  }

  async getNotesInfo(walletId: string): Promise<ShieldedNotesInfo> {
    const wallet = await this.walletDAO.getWalletById(walletId)
    if (wallet == null) return {undecodedCount: 0}
    const stored = await this.shieldedPoolDAO.getCount(wallet.network)
    const decoded = await this.walletDAO.getShieldedDecodedCount(walletId)
    return {undecodedCount: Math.max(stored - decoded, 0)}
  }

  private idleSyncState(): ShieldedSyncState {
    return { phase: 'idle', fetched: 0, total: 0, balance: null, notes: [], error: null, syncedAt: null }
  }

  getSyncState(walletId: string): ShieldedSyncState {
    return this.syncStates.get(walletId) ?? this.idleSyncState()
  }

  async startSync(walletId: string, password: string): Promise<ShieldedSyncState> {
    const current = this.syncStates.get(walletId)
    if (current != null && (current.phase === 'syncing' || current.phase === 'recovering')) {
      return current
    }

    const state: ShieldedSyncState = {
      phase: 'syncing', fetched: 0, total: 0, balance: null, notes: [], error: null, syncedAt: null
    }
    this.syncStates.set(walletId, state)

    try {
      const {seed, network} = await this.unlock(walletId, password)
      await this.cacheAddresses(walletId, seed, network)
      await this.checkForNewNotes(network, (fetched, total) => {
        state.fetched = fetched
        state.total = total
      })

      const priorNotes = await this.shieldedNoteDAO.getOwnedNotes(walletId)
      const decodedFrom = await this.walletDAO.getShieldedDecodedCount(walletId)
      const fresh = await this.shieldedPoolDAO.getEncryptedNotesFrom(network, decodedFrom)
      
      const owned = await this.shieldedPoolDAO.getEncryptedNotes(network, priorNotes.map(note => note.index))
      const notes = [...owned, ...fresh]

      if (notes.length === 0) {
        state.balance = '0'
        state.phase = 'done'
        state.syncedAt = Date.now()
        return state
      }

      const decodedUpTo = fresh.length > 0 ? fresh[fresh.length - 1].index + 1 : decodedFrom
      this.platform.request('sync', network, {seed, notes}, {
        onProgress: phase => { state.phase = syncPhase(phase) ?? state.phase },
      }).then(async result => {
        const all: ShieldedNoteInfo[] = result.notes.map(note => ({
          index: note.index,
          amount: note.amount.toString(),
          spent: note.spent,
          address: note.address,
        })).sort((a, b) => b.index - a.index)
        let balance = 0n
        for (const note of all) {
          if (!note.spent) balance += BigInt(note.amount)
        }
        state.balance = balance.toString()
        state.notes = all
        state.phase = 'done'
        state.syncedAt = Date.now()
        await this.shieldedNoteDAO.upsertNotes(walletId, all)
        await this.walletDAO.setShieldedDecodedCount(walletId, decodedUpTo)
      }).catch(e => this.failed(state, e))
    } catch (e) {
      state.phase = 'error'
      state.error = e instanceof Error ? e.message : String(e)
    }
    return state
  }

  private idleSpendState(): ShieldedSpendState {
    return { phase: 'idle', fetched: 0, total: 0, stHash: null, identityId: null, error: null }
  }

  // The worker rebuilds the commitment tree from the complete pool note set,
  // so spends ship the DB-cached ciphertexts after a delta top-up (a stale
  // cache would witness against an expired anchor).
  private async loadSpendNotes(network: Network, state: ShieldedSpendState): Promise<EncryptedNotePayload[]> {
    await this.checkForNewNotes(network, (fetched, total) => {
      state.fetched = fetched
      state.total = total
    })
    return this.shieldedPoolDAO.getAllEncryptedNotes(network)
  }

  getSpendState(walletId: string): ShieldedSpendState {
    return this.spendStates.get(walletId) ?? this.idleSpendState()
  }

  startTransfer(walletId: string, password: string, recipient: string, amountCredits: bigint, noteIndexes?: number[]): Promise<ShieldedSpendState> {
    return this.startSpend(walletId, password, 'transfer', recipient, amountCredits, noteIndexes)
  }

  startUnshield(walletId: string, password: string, outputAddress: string, amountCredits: bigint, noteIndexes?: number[]): Promise<ShieldedSpendState> {
    return this.startSpend(walletId, password, 'unshield', outputAddress, amountCredits, noteIndexes)
  }

  startWithdrawal(walletId: string, password: string, coreAddress: string, amountCredits: bigint, noteIndexes?: number[]): Promise<ShieldedSpendState> {
    return this.startSpend(walletId, password, 'withdrawal', coreAddress, amountCredits, noteIndexes)
  }

  // Returns the in-flight state when a spend is already running for this
  // wallet, otherwise installs a fresh one.
  private beginSpend(walletId: string): {state: ShieldedSpendState; running: boolean} {
    const current = this.spendStates.get(walletId)
    if (current != null && (current.phase === 'syncing' || current.phase === 'proving' || current.phase === 'broadcasting')) {
      return {state: current, running: true}
    }
    const state: ShieldedSpendState = {phase: 'syncing', fetched: 0, total: 0, stHash: null, identityId: null, error: null}
    this.spendStates.set(walletId, state)
    return {state, running: false}
  }

  private async startSpend(walletId: string, password: string, kind: SpendKind, recipient: string, amountCredits: bigint, noteIndexes?: number[]): Promise<ShieldedSpendState> {
    const {state, running} = this.beginSpend(walletId)
    if (running) return state

    try {
      if (amountCredits <= 0n) throw new Error('Amount must be greater than zero')

      const {seed, network} = await this.unlock(walletId, password)
      await this.cacheAddresses(walletId, seed, network)
      const notes = await this.loadSpendNotes(network, state)

      this.runSpend(walletId, network, state, {
        seed,
        kind,
        recipient,
        amountCredits,
        notes,
        noteIndexes: noteIndexes ?? null,
        identityIndex: null,
        failureAddress: null,
      })
    } catch (e) {
      this.failed(state, e)
    }
    return state
  }

  // Fire-and-forget: callers poll getSpendState, so the request settles into
  // the state object rather than being awaited.
  private runSpend(
    walletId: string,
    network: Network,
    state: ShieldedSpendState,
    payload: SpendPayload,
    identityCreate?: {identityIndex: number},
  ): void {
    this.platform.request('spend', network, payload, {
      onProgress: phase => { state.phase = spendPhase(phase) ?? state.phase },
      onNotesSpent: indexes => {
        this.markNotesSpent(walletId, indexes).catch(e =>
          console.error('Failed to record spent shielded notes', e))
      },
    }).then(result => {
      state.stHash = result.stHash
      state.identityId = result.identityId
      state.phase = 'done'
      if (identityCreate != null && result.identityId != null) {
        this.persistCreatedIdentity({walletId, network, ...identityCreate}, result.identityId).catch(e =>
          console.error('Failed to persist identity created from the shielded pool', e))
      }
    }).catch(e => this.failed(state, e))
  }

  async startIdentityCreate(walletId: string, password: string, denominationCredits: bigint): Promise<ShieldedSpendState> {
    const {state, running} = this.beginSpend(walletId)
    if (running) return state

    try {
      if (denominationCredits <= 0n) throw new Error('Amount must be greater than zero')

      const {seed, network, mnemonic} = await this.unlock(walletId, password)
      await this.cacheAddresses(walletId, seed, network)
      const notes = await this.loadSpendNotes(network, state)

      const localIdentities = await this.identityDAO.getIdentitiesByWalletId(walletId)
      const startIndex = localIdentities.reduce((max, identity) => Math.max(max, identity.identityIndex + 1), 0)
      const identityIndex = await this.identityRegistrationService.findNextIdentityIndex(mnemonic, startIndex, network)

      const failureAddress = (await this.keyPair.derivePlatformAddress(seed, network, PLATFORM_ACCOUNT, 0)).toBech32m(network)

      this.runSpend(walletId, network, state, {
        seed,
        kind: 'identityCreate',
        recipient: '',
        amountCredits: denominationCredits,
        notes,
        noteIndexes: null,
        identityIndex,
        failureAddress,
      }, {identityIndex})
    } catch (e) {
      this.failed(state, e)
    }
    return state
  }

  // Locks L1 coins and shields the credits straight into the pool, so they
  // never sit on a transparent platform address. An empty recipient shields to
  // this wallet's own address.
  async startShieldFromL1(walletId: string, recipient: string, amountDuffs: bigint, password: string): Promise<AssetLockFundingState> {
    shieldAmountFromLockedDuffs(amountDuffs)
    const {seed, network} = await this.unlock(walletId, password)

    let destination = recipient
    if (destination.length > 0) {
      try {
        OrchardAddressWASM.fromBech32m(destination)
      } catch {
        throw new Error('Invalid shielded recipient address')
      }
    } else {
      destination = this.keyPair.deriveShieldedAddress(seed, network, SHIELDED_ACCOUNT).toBech32m(network)
    }

    const state = await this.assetLock.begin(walletId, 'shielded', destination, amountDuffs)
    void this.runFunding(state, async () => {
      const acquired = await this.assetLock.acquire(state, {
        walletId, kind: 'shielded', destination, amountDuffs, password,
      })
      await this.settleShield(seed, network, state, acquired)
    })
    return state
  }

  async resumeShieldFromL1(walletId: string, row: AssetLockFundingRow, password: string): Promise<AssetLockFundingState> {
    const {seed, network} = await this.unlock(walletId, password)

    const state = this.assetLock.resume(walletId, row)
    void this.runFunding(state, async () => {
      const acquired = await this.assetLock.reacquire(state, row)
      await this.settleShield(seed, network, state, acquired)
    })
    return state
  }

  private runFunding(state: AssetLockFundingState, work: () => Promise<void>): Promise<void> {
    return work().catch(error => this.assetLock.fail(state, error))
  }

  private async settleShield(
    seed: Uint8Array,
    network: Network,
    state: AssetLockFundingState,
    {row, proof}: AcquiredAssetLock,
  ): Promise<void> {
    await this.assetLock.markBroadcastingSt(state, row.txid)

    const surplus = await this.keyPair.derivePlatformAddress(seed, network, PLATFORM_ACCOUNT, 0)
    const {stHash} = await this.platform.request('shieldFromAssetLock', network, {
      seed,
      txid: row.txid,
      outputIndex: row.outputIndex,
      assetLockProof: proof,
      creditDerivationPath: row.creditDerivationPath,
      recipient: row.toPlatformAddress,
      shieldAmountCredits: shieldAmountFromLockedDuffs(BigInt(row.amountDuffs)),
      surplusAddress: surplus.toBech32m(network),
    })

    await this.assetLock.done(state, row.txid, stHash)
  }

  private async markNotesSpent(walletId: string, indexes: number[]): Promise<void> {
    await this.shieldedNoteDAO.markSpent(walletId, indexes)
    const sync = this.syncStates.get(walletId)
    if (sync == null || sync.phase !== 'done') return
    const spent = new Set(indexes)
    let balance = sync.balance !== null ? BigInt(sync.balance) : 0n
    for (const note of sync.notes) {
      if (!note.spent && spent.has(note.index)) {
        note.spent = true
        balance -= BigInt(note.amount)
      }
    }
    sync.balance = (balance > 0n ? balance : 0n).toString()
  }

}
