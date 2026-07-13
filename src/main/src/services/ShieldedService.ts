import { utilityProcess, UtilityProcess } from 'electron'
import path from 'path'
import { randomUUID } from 'crypto'
import { DashPlatformSDK } from 'dash-platform-sdk'
import { Network } from '../types'
import { WalletDAO } from '../database/WalletDAO'
import { ShieldedNoteDAO } from '../database/ShieldedNoteDAO'
import { decryptMnemonic } from '../utils'
import {
  ShieldedCommand,
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
  error: string | null
}

const SHIELDED_ACCOUNT = 0
const PLATFORM_ACCOUNT = 0

// Cap on the per-child output we retain; attached to crash reports so a
// worker death carries its own cause instead of just an exit code.
const CHILD_OUTPUT_TAIL_LIMIT = 8192

// Main-process facade for the shielded subsystem. Everything CPU-bound
// (Halo2 prover, note trial-decryption, proof building) runs in a forked
// utility process (shielded.js); this class translates wallet-domain calls
// into worker commands, tracks per-wallet sync/spend state from worker
// events, and persists spent-note bookkeeping through ShieldedNoteDAO.
export class ShieldedService {
  private sdk: DashPlatformSDK
  private walletDAO: WalletDAO
  private shieldedNoteDAO: ShieldedNoteDAO
  private child: UtilityProcess | null = null
  private childOutputTail = ''
  private proverState: ShieldedProverState = 'idle'
  private proverError: string | null = null
  private syncStates = new Map<string, ShieldedSyncState>()
  private spendStates = new Map<string, ShieldedSpendState>()
  private addresses = new Map<string, string[]>()
  private pendingSyncs = new Map<string, string>()
  private pendingSpends = new Map<string, string>()
  private pendingShields = new Map<string, {resolve: (stHash: string) => void; reject: (error: Error) => void}>()

  constructor(sdk: DashPlatformSDK, walletDAO: WalletDAO, shieldedNoteDAO: ShieldedNoteDAO) {
    this.sdk = sdk
    this.walletDAO = walletDAO
    this.shieldedNoteDAO = shieldedNoteDAO
  }

  private ensureChild(): UtilityProcess {
    if (this.child) return this.child

    const scriptPath = path.join(__dirname, 'shielded.js')
    this.childOutputTail = ''
    const child = utilityProcess.fork(scriptPath, [], { serviceName: 'shielded', stdio: ['ignore', 'pipe', 'pipe'] })

    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      this.childOutputTail = (this.childOutputTail + text).slice(-CHILD_OUTPUT_TAIL_LIMIT)
      process.stdout.write(text)
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      this.childOutputTail = (this.childOutputTail + text).slice(-CHILD_OUTPUT_TAIL_LIMIT)
      process.stderr.write(text)
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
    for (const walletId of this.pendingSyncs.values()) {
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
    for (const {reject} of this.pendingShields.values()) {
      reject(new Error(message))
    }
    this.pendingShields.clear()
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
      const state = this.stateForSync(event.requestId)
      this.pendingSyncs.delete(event.requestId)
      if (state == null) return
      if (event.ok) {
        state.balance = event.balance
        state.notes = event.notes
        state.phase = 'done'
        state.syncedAt = Date.now()
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
      this.pendingSpends.delete(event.requestId)
      if (state == null) return
      if (event.ok) {
        state.stHash = event.stHash
        state.phase = 'done'
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
    const walletId = this.pendingSyncs.get(requestId)
    return walletId != null ? this.syncStates.get(walletId) ?? null : null
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
    if (password == null || password.length === 0) return null

    const {seed, network} = await this.unlock(walletId, password)
    return this.cacheAddresses(walletId, seed, network)
  }

  async addAddress(walletId: string, password: string): Promise<string[]> {
    const {seed, network} = await this.unlock(walletId, password)
    const count = await this.walletDAO.getShieldedAddressCount(walletId)
    await this.walletDAO.setShieldedAddressCount(walletId, count + 1)
    return this.cacheAddresses(walletId, seed, network)
  }

  // All diversified addresses of the account share one incoming viewing key,
  // so sync/spend in the worker are unaffected by how many exist — only
  // derivation for display happens here.
  private async cacheAddresses(walletId: string, seed: Uint8Array, network: Network): Promise<string[]> {
    const count = await this.walletDAO.getShieldedAddressCount(walletId)
    const list: string[] = []
    for (let i = 0; i < count; i++) {
      list.push(this.sdk.keyPair.deriveShieldedAddress(seed, network, SHIELDED_ACCOUNT, i).toBech32m(network))
    }
    this.addresses.set(walletId, list)
    return list
  }

  private async unlock(walletId: string, password: string): Promise<{seed: Uint8Array; network: Network}> {
    const wallet = await this.walletDAO.getWalletById(walletId)
    if (wallet == null) throw new Error('Wallet not found')

    let mnemonic: string
    try {
      mnemonic = decryptMnemonic(wallet.encryptedMnemonic, password)
    } catch {
      throw new Error('Invalid wallet password')
    }
    this.sdk.setNetwork(wallet.network)
    const seed = this.sdk.keyPair.mnemonicToSeed(mnemonic)

    if (wallet.platformXpub == null) {
      const xpub = await this.sdk.keyPair.derivePlatformAccountXpub(seed, wallet.network, PLATFORM_ACCOUNT)
      await this.walletDAO.setPlatformXpub(walletId, xpub)
    }

    return {seed, network: wallet.network}
  }

  async getPoolInfo(network: Network): Promise<ShieldedPoolInfo> {
    this.sdk.setNetwork(network)
    const [poolState, notesCount] = await Promise.all([
      this.sdk.shielded.getShieldedPoolState(),
      this.sdk.shielded.getShieldedNotesCount()
    ])
    return {
      poolState: poolState != null ? poolState.toString() : null,
      notesCount: notesCount != null ? notesCount.toString() : null
    }
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
      const spent = await this.shieldedNoteDAO.getSpentIndexes(walletId)

      const requestId = randomUUID()
      this.pendingSyncs.set(requestId, walletId)
      this.send({type: 'sync', requestId, network, seed, spentIndexes: [...spent]})
    } catch (e) {
      state.phase = 'error'
      state.error = e instanceof Error ? e.message : String(e)
    }
    return state
  }

  private idleSpendState(): ShieldedSpendState {
    return { phase: 'idle', fetched: 0, total: 0, stHash: null, error: null }
  }

  getSpendState(walletId: string): ShieldedSpendState {
    return this.spendStates.get(walletId) ?? this.idleSpendState()
  }

  startTransfer(walletId: string, password: string, recipient: string, amountCredits: bigint): Promise<ShieldedSpendState> {
    return this.startSpend(walletId, password, 'transfer', recipient, amountCredits)
  }

  startUnshield(walletId: string, password: string, outputAddress: string, amountCredits: bigint): Promise<ShieldedSpendState> {
    return this.startSpend(walletId, password, 'unshield', outputAddress, amountCredits)
  }

  startWithdrawal(walletId: string, password: string, coreAddress: string, amountCredits: bigint): Promise<ShieldedSpendState> {
    return this.startSpend(walletId, password, 'withdrawal', coreAddress, amountCredits)
  }

  private async startSpend(walletId: string, password: string, kind: ShieldedSpendKind, recipient: string, amountCredits: bigint): Promise<ShieldedSpendState> {
    const current = this.spendStates.get(walletId)
    if (current != null && (current.phase === 'syncing' || current.phase === 'proving' || current.phase === 'broadcasting')) {
      return current
    }

    const state: ShieldedSpendState = { phase: 'syncing', fetched: 0, total: 0, stHash: null, error: null }
    this.spendStates.set(walletId, state)

    try {
      if (amountCredits <= 0n) throw new Error('Amount must be greater than zero')

      const {seed, network} = await this.unlock(walletId, password)
      await this.cacheAddresses(walletId, seed, network)
      const spent = await this.shieldedNoteDAO.getSpentIndexes(walletId)

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
