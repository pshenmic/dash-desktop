import { utilityProcess, UtilityProcess } from 'electron'
import path from 'path'
import { logChildOutput } from '../logger'
import { randomUUID } from 'crypto'
import { SdkProvider } from './SdkProvider'
import { IdentityRegistrationService } from './IdentityRegistrationService'
import { Network } from '../types'
import { WalletDAO } from '../database/WalletDAO'
import { IdentityDAO } from '../database/IdentityDAO'
import { ShieldedNoteDAO } from '../database/ShieldedNoteDAO'
import { ShieldedAddressDAO } from '../database/ShieldedAddressDAO'
import { decryptMnemonic } from '../utils'
import { SHIELDED_NOTES_FETCH_BATCH } from '../constants'
import {
  ShieldAssetLockProofParams,
  ShieldedCommand,
  ShieldedEncryptedNotePayload,
  ShieldedEvent,
  ShieldedProverState,
  ShieldedSpendKind,
  ShieldedSpendPhase,
  ShieldedSyncPhase,
  ShieldSource,
} from '../../shielded/types/messages'

export type { ShieldedProverState, ShieldedSyncPhase, ShieldedSpendPhase } from '../../shielded/types/messages'

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

interface PendingSync {
  walletId: string
  decodedUpTo: number
  priorNotes: ShieldedNoteInfo[]
}

const SHIELDED_ACCOUNT = 0
const PLATFORM_ACCOUNT = 0
const COIN_TYPE: Record<Network, number> = {mainnet: 5, testnet: 1}
// Bound on how far addAddress derives forward while skipping used
// (already-received-on) diversified addresses.
const NEW_ADDRESS_LOOKAHEAD_LIMIT = 100

// Cap on the per-child output we retain; attached to crash reports so a
// worker death carries its own cause instead of just an exit code.
const CHILD_OUTPUT_TAIL_LIMIT = 8192

// Main-process facade for the shielded subsystem. Everything CPU-bound
// (Halo2 prover, note trial-decryption, proof building) runs in a forked
// utility process (shielded.js); this class translates wallet-domain calls
// into worker commands, tracks per-wallet sync/spend state from worker
// events, and persists spent-note bookkeeping through ShieldedNoteDAO.
export class ShieldedService {
  private sdkProvider: SdkProvider
  private walletDAO: WalletDAO
  private identityDAO: IdentityDAO
  private shieldedNoteDAO: ShieldedNoteDAO
  private shieldedAddressDAO: ShieldedAddressDAO
  private identityRegistrationService: IdentityRegistrationService
  private child: UtilityProcess | null = null
  private childOutputTail = ''
  private proverState: ShieldedProverState = 'idle'
  private proverError: string | null = null
  private syncStates = new Map<string, ShieldedSyncState>()
  private spendStates = new Map<string, ShieldedSpendState>()
  private addresses = new Map<string, string[]>()
  private pendingSyncs = new Map<string, PendingSync>()
  private noteFetches = new Map<string, Promise<void>>()
  private pendingSpends = new Map<string, string>()
  private pendingIdentityCreates = new Map<string, {walletId: string; identityIndex: number; network: Network}>()
  private pendingShields = new Map<string, {resolve: (stHash: string) => void; reject: (error: Error) => void}>()

  constructor(sdkProvider: SdkProvider, walletDAO: WalletDAO, identityDAO: IdentityDAO, shieldedNoteDAO: ShieldedNoteDAO, shieldedAddressDAO: ShieldedAddressDAO, identityRegistrationService: IdentityRegistrationService) {
    this.sdkProvider = sdkProvider
    this.walletDAO = walletDAO
    this.identityDAO = identityDAO
    this.shieldedNoteDAO = shieldedNoteDAO
    this.shieldedAddressDAO = shieldedAddressDAO
    this.identityRegistrationService = identityRegistrationService
  }

  private ensureChild(): UtilityProcess {
    if (this.child) return this.child

    const scriptPath = path.join(__dirname, 'shielded.js')
    this.childOutputTail = ''
    const child = utilityProcess.fork(scriptPath, [], { serviceName: 'shielded', stdio: ['ignore', 'pipe', 'pipe'] })

    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      this.childOutputTail = (this.childOutputTail + text).slice(-CHILD_OUTPUT_TAIL_LIMIT)
      logChildOutput('shielded', text, false)
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      this.childOutputTail = (this.childOutputTail + text).slice(-CHILD_OUTPUT_TAIL_LIMIT)
      logChildOutput('shielded', text, true)
    })

    child.on('message', (event: ShieldedEvent) => {
      this.onEvent(event)
    })

    child.on('exit', code => {
      const tail = this.childOutputTail.trim()
      console.log(`[shielded] utility process exited code=${code}`)
      if (tail) console.error(`[shielded] last output before exit:\n${tail}`)
      this.child = null
      this.failPending(`shielded utility process exited (code=${code})${tail ? `\n--- shielded output (tail) ---\n${tail}` : ''}`)
      this.proverState = 'idle'
      this.proverError = null
    })

    this.child = child
    return child
  }

  private send(command: ShieldedCommand): void {
    this.ensureChild().postMessage(command)
  }

  private failPending(message: string): void {
    for (const {walletId} of this.pendingSyncs.values()) {
      const state = this.syncStates.get(walletId)
      if (state != null && state.phase !== 'done') {
        state.phase = 'error'
        state.error = message
      }
    }
    this.pendingSyncs.clear()
    for (const walletId of this.pendingSpends.values()) {
      const state = this.spendStates.get(walletId)
      if (state != null && state.phase !== 'done') {
        state.phase = 'error'
        state.error = message
      }
    }
    this.pendingSpends.clear()
    this.pendingIdentityCreates.clear()
    for (const {reject} of this.pendingShields.values()) {
      reject(new Error(message))
    }
    this.pendingShields.clear()
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

  private onEvent(event: ShieldedEvent): void {
    if (event.type === 'proverStatus') {
      this.proverState = event.state
      this.proverError = event.error
      return
    }
    if (event.type === 'error') {
      console.error('[shielded] utility process error:', event.message)
      return
    }
    if (event.type === 'syncProgress') {
      const state = this.stateForSync(event.requestId)
      if (state == null) return
      state.phase = event.phase
      state.fetched = event.fetched
      state.total = event.total
      return
    }
    if (event.type === 'syncResult') {
      const pending = this.pendingSyncs.get(event.requestId)
      const state = this.stateForSync(event.requestId)
      this.pendingSyncs.delete(event.requestId)
      if (pending == null || state == null) return
      if (event.ok) {
        // The worker only decoded the new ciphertexts; merge with the owned
        // notes already cached in the DB and recompute the full balance.
        const merged = new Map<number, ShieldedNoteInfo>()
        for (const note of pending.priorNotes) merged.set(note.index, note)
        for (const note of event.notes) merged.set(note.index, note)
        const notes = [...merged.values()].sort((a, b) => b.index - a.index)
        let balance = 0n
        for (const note of notes) {
          if (!note.spent) balance += BigInt(note.amount)
        }
        state.balance = balance.toString()
        state.notes = notes
        state.phase = 'done'
        state.syncedAt = Date.now()
        this.shieldedNoteDAO.upsertNotes(pending.walletId, event.notes)
          .then(() => this.shieldedNoteDAO.markDecodedBelow(pending.walletId, pending.decodedUpTo))
          .catch(e => console.error('Failed to persist shielded notes', e))
      } else {
        state.phase = 'error'
        state.error = event.error
      }
      return
    }
    if (event.type === 'spendProgress') {
      const state = this.stateForSpend(event.requestId)
      if (state == null) return
      state.phase = event.phase
      state.fetched = event.fetched
      state.total = event.total
      return
    }
    if (event.type === 'notesSpent') {
      const walletId = this.pendingSpends.get(event.requestId)
      if (walletId == null) return
      this.markNotesSpent(walletId, event.indexes).catch(e =>
        console.error('Failed to record spent shielded notes', e))
      return
    }
    if (event.type === 'spendResult') {
      const state = this.stateForSpend(event.requestId)
      const identityCreate = this.pendingIdentityCreates.get(event.requestId)
      this.pendingSpends.delete(event.requestId)
      this.pendingIdentityCreates.delete(event.requestId)
      if (state == null) return
      if (event.ok) {
        state.stHash = event.stHash
        state.identityId = event.identityId ?? null
        state.phase = 'done'
        if (identityCreate != null && event.identityId != null) {
          this.persistCreatedIdentity(identityCreate, event.identityId).catch(e =>
            console.error('Failed to persist identity created from the shielded pool', e))
        }
      } else {
        state.phase = 'error'
        state.error = event.error
      }
      return
    }
    if (event.type === 'shieldResult') {
      const pending = this.pendingShields.get(event.requestId)
      this.pendingShields.delete(event.requestId)
      if (pending == null) return
      if (event.ok && event.stHash != null) {
        pending.resolve(event.stHash)
      } else {
        pending.reject(new Error(event.error ?? 'Shield failed'))
      }
    }
  }

  private stateForSync(requestId: string): ShieldedSyncState | null {
    const pending = this.pendingSyncs.get(requestId)
    return pending != null ? this.syncStates.get(pending.walletId) ?? null : null
  }

  private stateForSpend(requestId: string): ShieldedSpendState | null {
    const walletId = this.pendingSpends.get(requestId)
    return walletId != null ? this.spendStates.get(walletId) ?? null : null
  }

  getStatus(): ShieldedStatus {
    if (this.proverState === 'idle') {
      this.proverState = 'preparing'
      this.send({type: 'initProver'})
    }
    return {
      prover: this.proverState,
      ready: this.proverState === 'ready',
      error: this.proverError
    }
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
    const keyPair = this.sdkProvider.getPlatformSDK(network).keyPair
    let count = await this.walletDAO.getShieldedAddressCount(walletId)
    const limit = count + NEW_ADDRESS_LOOKAHEAD_LIMIT
    let address: string
    do {
      count++
      address = keyPair.deriveShieldedAddress(seed, network, SHIELDED_ACCOUNT, count - 1).toBech32m(network)
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
      list.push(this.sdkProvider.getPlatformSDK(network).keyPair.deriveShieldedAddress(seed, network, SHIELDED_ACCOUNT, i).toBech32m(network))
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
    const keyPair = this.sdkProvider.getPlatformSDK(wallet.network).keyPair
    const seed = keyPair.mnemonicToSeed(mnemonic)

    if (wallet.platformXpub == null) {
      const xpub = await keyPair.derivePlatformAccountXpub(seed, wallet.network, PLATFORM_ACCOUNT)
      await this.walletDAO.setPlatformXpub(walletId, xpub)
    }

    return {seed, network: wallet.network, mnemonic}
  }

  async getPoolInfo(network: Network): Promise<ShieldedPoolInfo> {
    const sdk = this.sdkProvider.getPlatformSDK(network)
    const [poolState, notesCount] = await Promise.all([
      sdk.shielded.getShieldedPoolState(),
      sdk.shielded.getShieldedNotesCount()
    ])
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
    const sdk = this.sdkProvider.getPlatformSDK(network)
    const totalBig = await sdk.shielded.getShieldedNotesCount()
    const total = totalBig != null ? Number(totalBig) : 0
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
      const count = Math.min(SHIELDED_NOTES_FETCH_BATCH, total - cursor)
      const batch = await sdk.shielded.getShieldedEncryptedNotes(BigInt(cursor), count)
      if (batch.length === 0) break
      await this.shieldedNoteDAO.saveEncryptedNotes(walletId, batch.map((note, i) => ({
        index: cursor + i,
        nullifier: note.nullifier,
        cmx: note.cmx,
        encryptedNote: note.encryptedNote,
        cvNet: note.cvNet,
      })))
      downloaded += batch.length
      cursor += batch.length
      onProgress?.(Math.min(downloaded, missing), missing)
      if (batch.length < count) break
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

      const spent = await this.shieldedNoteDAO.getSpentIndexes(walletId)
      const requestId = randomUUID()
      this.pendingSyncs.set(requestId, {
        walletId,
        decodedUpTo: notes[notes.length - 1].index + 1,
        priorNotes,
      })
      this.send({type: 'sync', requestId, network, seed, spentIndexes: [...spent], notes})
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
  private async loadSpendNotes(walletId: string, network: Network, state: ShieldedSpendState): Promise<ShieldedEncryptedNotePayload[]> {
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

  private async startSpend(walletId: string, password: string, kind: ShieldedSpendKind, recipient: string, amountCredits: bigint, noteIndexes?: number[]): Promise<ShieldedSpendState> {
    const current = this.spendStates.get(walletId)
    if (current != null && (current.phase === 'syncing' || current.phase === 'proving' || current.phase === 'broadcasting')) {
      return current
    }

    const state: ShieldedSpendState = { phase: 'syncing', fetched: 0, total: 0, stHash: null, identityId: null, error: null }
    this.spendStates.set(walletId, state)

    try {
      if (amountCredits <= 0n) throw new Error('Amount must be greater than zero')

      const {seed, network} = await this.unlock(walletId, password)
      await this.cacheAddresses(walletId, seed, network)
      const spent = await this.shieldedNoteDAO.getSpentIndexes(walletId)
      const notes = await this.loadSpendNotes(walletId, network, state)

      const requestId = randomUUID()
      this.pendingSpends.set(requestId, walletId)
      this.send({
        type: 'spend',
        requestId,
        network,
        seed,
        spentIndexes: [...spent],
        kind,
        recipient,
        amountCredits: amountCredits.toString(),
        notes,
        noteIndexes,
      })
    } catch (e) {
      state.phase = 'error'
      state.error = e instanceof Error ? e.message : String(e)
    }
    return state
  }

  async startIdentityCreate(walletId: string, password: string, denominationCredits: bigint): Promise<ShieldedSpendState> {
    const current = this.spendStates.get(walletId)
    if (current != null && (current.phase === 'syncing' || current.phase === 'proving' || current.phase === 'broadcasting')) {
      return current
    }

    const state: ShieldedSpendState = { phase: 'syncing', fetched: 0, total: 0, stHash: null, identityId: null, error: null }
    this.spendStates.set(walletId, state)

    try {
      if (denominationCredits <= 0n) throw new Error('Amount must be greater than zero')

      const {seed, network, mnemonic} = await this.unlock(walletId, password)
      await this.cacheAddresses(walletId, seed, network)
      const spent = await this.shieldedNoteDAO.getSpentIndexes(walletId)
      const notes = await this.loadSpendNotes(walletId, network, state)

      const localIdentities = await this.identityDAO.getIdentitiesByWalletId(walletId)
      const startIndex = localIdentities.reduce((max, identity) => Math.max(max, identity.identityIndex + 1), 0)
      const identityIndex = await this.identityRegistrationService.findNextIdentityIndex(mnemonic, startIndex, network)

      const failureAddress = (await this.sdkProvider.getPlatformSDK(network).keyPair.derivePlatformAddress(seed, network, PLATFORM_ACCOUNT, 0)).toBech32m(network)

      const requestId = randomUUID()
      this.pendingSpends.set(requestId, walletId)
      this.pendingIdentityCreates.set(requestId, {walletId, identityIndex, network})
      this.send({
        type: 'spend',
        requestId,
        network,
        seed,
        spentIndexes: [...spent],
        kind: 'identityCreate',
        recipient: '',
        amountCredits: denominationCredits.toString(),
        notes,
        identityIndex,
        failureAddress,
      })
    } catch (e) {
      state.phase = 'error'
      state.error = e instanceof Error ? e.message : String(e)
    }
    return state
  }

  // Proves and broadcasts a shield transition in the utility process on
  // behalf of PlatformAddressService. Resolves with the state transition hash.
  shield(network: Network, seed: Uint8Array, source: ShieldSource, recipient: string, amountCredits: bigint): Promise<string> {
    const requestId = randomUUID()
    return new Promise<string>((resolve, reject) => {
      this.pendingShields.set(requestId, {resolve, reject})
      this.send({type: 'shield', requestId, network, seed, source, recipient, amountCredits: amountCredits.toString()})
    })
  }

  shieldFromAssetLock(network: Network, seed: Uint8Array, params: {
    txid: string
    outputIndex: number
    assetLockProof: ShieldAssetLockProofParams
    creditDerivationPath: string
    recipient: string
    shieldAmountCredits: bigint
    surplusAddress: string | null
  }): Promise<string> {
    const requestId = randomUUID()
    return new Promise<string>((resolve, reject) => {
      this.pendingShields.set(requestId, {resolve, reject})
      this.send({
        type: 'shieldFromAssetLock',
        requestId,
        network,
        seed,
        txid: params.txid,
        outputIndex: params.outputIndex,
        assetLockProof: params.assetLockProof,
        creditDerivationPath: params.creditDerivationPath,
        recipient: params.recipient,
        shieldAmountCredits: params.shieldAmountCredits.toString(),
        surplusAddress: params.surplusAddress,
      })
    })
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

  shutdown = async (): Promise<void> => {
    if (!this.child) return
    const child = this.child
    const exited = new Promise<void>((resolve) => {
      child.once('exit', () => resolve())
    })
    child.kill()
    await exited
    this.child = null
  }
}
