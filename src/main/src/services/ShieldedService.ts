import { KeyPairController } from 'dash-platform-sdk/src/keyPair/index.js'
import { IdentityRegistrationService } from './IdentityRegistrationService'
import { Network } from '../types'
import { WalletDAO } from '../database/WalletDAO'
import { IdentityDAO } from '../database/IdentityDAO'
import { ShieldedNoteDAO } from '../database/ShieldedNoteDAO'
import { ShieldedAddressDAO } from '../database/ShieldedAddressDAO'
import { decryptMnemonic } from '../utils'
import { SHIELDED_NOTES_FETCH_BATCH } from '../constants'
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

const SHIELDED_ACCOUNT = 0
const PLATFORM_ACCOUNT = 0
const COIN_TYPE: Record<Network, number> = {mainnet: 5, testnet: 1}
// Bound on how far addAddress derives forward while skipping used
// (already-received-on) diversified addresses.
const NEW_ADDRESS_LOOKAHEAD_LIMIT = 100

// Wallet-domain layer over the shielded operations of the platform worker.
// Owns unlocking, address derivation for display, per-wallet sync/spend state
// and the ShieldedNoteDAO; everything CPU-bound or network-bound is a
// PlatformWorkerService request.
export class ShieldedService {
  private walletDAO: WalletDAO
  private identityDAO: IdentityDAO
  private shieldedNoteDAO: ShieldedNoteDAO
  private shieldedAddressDAO: ShieldedAddressDAO
  private identityRegistrationService: IdentityRegistrationService
  private platform: PlatformWorkerService
  private syncStates = new Map<string, ShieldedSyncState>()
  private spendStates = new Map<string, ShieldedSpendState>()
  private addresses = new Map<string, string[]>()
  private noteFetches = new Map<string, Promise<void>>()
  // Derivation only. A DashPlatformSDK would build a gRPC pool and fetch the
  // evonode list to do local maths.
  private keyPair = new KeyPairController()

  constructor(walletDAO: WalletDAO, identityDAO: IdentityDAO, shieldedNoteDAO: ShieldedNoteDAO, shieldedAddressDAO: ShieldedAddressDAO, identityRegistrationService: IdentityRegistrationService, platform: PlatformWorkerService) {
    this.walletDAO = walletDAO
    this.identityDAO = identityDAO
    this.shieldedNoteDAO = shieldedNoteDAO
    this.shieldedAddressDAO = shieldedAddressDAO
    this.identityRegistrationService = identityRegistrationService
    this.platform = platform
  }

  private async persistCreatedIdentity(context: {walletId: string; identityIndex: number; network: Network}, identifier: string): Promise<void> {
    const existing = await this.identityDAO.getByIdentifier(context.walletId, identifier)
    if (existing != null) return
    const coinType = COIN_TYPE[context.network]
    await this.identityDAO.insertIdentity({
      walletId: context.walletId,
      identityIndex: context.identityIndex,
      identifier,
      derivationPath: `m/9'/${coinType}'/0'/0/${context.identityIndex}`,
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

  async initAddresses(walletId: string, seed: Uint8Array, network: Network): Promise<void> {
    await this.cacheAddresses(walletId, seed, network)
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

  // Compares the pool note count with the local cache and downloads the
  // ciphertexts of any notes not stored yet. Needs no password: the payloads
  // are persisted undecoded (is_decoded = false) and trial-decrypted later,
  // when the user unlocks a sync.
  checkForNewNotes(walletId: string, network: Network, onProgress?: (fetched: number, total: number) => void): Promise<void> {
    const inFlight = this.noteFetches.get(walletId)
    if (inFlight != null) return inFlight
    const fetch = this.fetchNewNotes(walletId, network, onProgress)
      .finally(() => this.noteFetches.delete(walletId))
    this.noteFetches.set(walletId, fetch)
    return fetch
  }

  private async fetchNewNotes(walletId: string, network: Network, onProgress?: (fetched: number, total: number) => void): Promise<void> {
    const {count} = await this.platform.request('notesCount', network, {})
    const total = count != null ? Number(count) : 0
    const known = await this.shieldedNoteDAO.getKnownCount(walletId)
    if (total > known) {
      await this.shieldedNoteDAO.insertUndecoded(walletId, known, total)
    }

    const fetched = await this.shieldedNoteDAO.getFetchedCount(walletId)
    if (fetched >= total) return

    const missing = total - fetched
    let cursor = Math.floor(fetched / SHIELDED_NOTES_FETCH_BATCH) * SHIELDED_NOTES_FETCH_BATCH
    let downloaded = 0
    onProgress?.(0, missing)
    while (cursor < total) {
      const batchSize = Math.min(SHIELDED_NOTES_FETCH_BATCH, total - cursor)
      const {notes} = await this.platform.request('encryptedNotes', network, {startIndex: cursor, count: batchSize})
      if (notes.length === 0) break
      await this.shieldedNoteDAO.saveEncryptedNotes(walletId, notes)
      downloaded += notes.length
      cursor += notes.length
      onProgress?.(Math.min(downloaded, missing), missing)
      if (notes.length < batchSize) break
    }
  }

  async getNotesInfo(walletId: string): Promise<ShieldedNotesInfo> {
    return {undecodedCount: await this.shieldedNoteDAO.getUndecodedCount(walletId)}
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
      await this.checkForNewNotes(walletId, network, (fetched, total) => {
        state.fetched = fetched
        state.total = total
      })

      const priorNotes = await this.shieldedNoteDAO.getOwnedNotes(walletId)
      const undecoded = await this.shieldedNoteDAO.getUndecodedIndexes(walletId)
      const notes = await this.shieldedNoteDAO.getEncryptedNotes(walletId, undecoded)
      if (notes.length < undecoded.length) {
        throw new Error('Could not download new shielded notes. Check your connection and try again.')
      }

      if (notes.length === 0) {
        let balance = 0n
        for (const note of priorNotes) {
          if (!note.spent) balance += BigInt(note.amount)
        }
        state.balance = balance.toString()
        state.notes = priorNotes
        state.phase = 'done'
        state.syncedAt = Date.now()
        return state
      }

      const decodedUpTo = notes[notes.length - 1].index + 1
      this.platform.request('sync', network, {seed, notes}, {
        onProgress: phase => { state.phase = syncPhase(phase) ?? state.phase },
      }).then(async result => {
        // The worker only decoded the new ciphertexts; merge with the owned
        // notes already cached in the DB and recompute the full balance.
        const decoded: ShieldedNoteInfo[] = result.notes.map(note => ({
          index: note.index,
          amount: note.amount.toString(),
          spent: note.spent,
          address: note.address,
        }))
        const merged = new Map<number, ShieldedNoteInfo>()
        for (const note of priorNotes) merged.set(note.index, note)
        for (const note of decoded) merged.set(note.index, note)
        const all = [...merged.values()].sort((a, b) => b.index - a.index)
        let balance = 0n
        for (const note of all) {
          if (!note.spent) balance += BigInt(note.amount)
        }
        state.balance = balance.toString()
        state.notes = all
        state.phase = 'done'
        state.syncedAt = Date.now()
        await this.shieldedNoteDAO.upsertNotes(walletId, decoded)
        await this.shieldedNoteDAO.markDecodedBelow(walletId, decodedUpTo)
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
  private async loadSpendNotes(walletId: string, network: Network, state: ShieldedSpendState): Promise<EncryptedNotePayload[]> {
    await this.checkForNewNotes(walletId, network, (fetched, total) => {
      state.fetched = fetched
      state.total = total
    })
    const known = await this.shieldedNoteDAO.getKnownCount(walletId)
    const notes = await this.shieldedNoteDAO.getAllEncryptedNotes(walletId)
    if (notes.length < known) {
      throw new Error('Could not download new shielded notes. Check your connection and try again.')
    }
    return notes
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
      const notes = await this.loadSpendNotes(walletId, network, state)

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
      const notes = await this.loadSpendNotes(walletId, network, state)

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

  // Proves and broadcasts a shield transition in the platform worker on
  // behalf of PlatformAddressService. Resolves with the state transition hash.
  async shield(network: Network, seed: Uint8Array, source: ShieldSource, recipient: string, amountCredits: bigint): Promise<string> {
    const {stHash} = await this.platform.request('shield', network, {seed, source, recipient, amountCredits})
    return stHash
  }

  async shieldFromAssetLock(network: Network, seed: Uint8Array, params: {
    txid: string
    outputIndex: number
    assetLockProof: AssetLockProofParams
    creditDerivationPath: string
    recipient: string
    shieldAmountCredits: bigint
    surplusAddress: string | null
  }): Promise<string> {
    const {stHash} = await this.platform.request('shieldFromAssetLock', network, {seed, ...params})
    return stHash
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
