import { DashPlatformSDK } from 'dash-platform-sdk'
import { Network } from '../types'
import { WalletDAO } from '../database/WalletDAO'
import { ShieldedNoteDAO } from '../database/ShieldedNoteDAO'
import { decryptMnemonic } from '../utils'
import {
  OrchardAddressWASM,
  RecoveredNoteWASM,
  ShieldedMemoWASM,
  ShieldedTransferTransitionWASM,
  ShieldedWithdrawalTransitionWASM,
  StateTransitionWASM,
  UnshieldTransitionWASM,
} from 'pshenmic-dpp'
import { coreAddressToScript } from './coreScript'
import { maxSpendableCredits, selectSpendNotes } from './shieldedNoteSelection'

export type ShieldedWarmupState = 'idle' | 'preparing' | 'ready' | 'error'

export interface ShieldedStatus {
  warmup: ShieldedWarmupState
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
}

export type ShieldedSyncPhase = 'idle' | 'syncing' | 'recovering' | 'done' | 'error'

export interface ShieldedSyncState {
  phase: ShieldedSyncPhase
  fetched: number
  total: number
  balance: string | null
  notes: ShieldedNoteInfo[]
  error: string | null
  syncedAt: number | null
}

export type ShieldedSpendPhase = 'idle' | 'syncing' | 'proving' | 'broadcasting' | 'done' | 'error'

export interface ShieldedSpendState {
  phase: ShieldedSpendPhase
  fetched: number
  total: number
  stHash: string | null
  error: string | null
}

type SpendRequest =
  | { kind: 'transfer'; recipient: string; amount: bigint }
  | { kind: 'unshield'; outputAddress: string; amount: bigint }
  | { kind: 'withdrawal'; coreAddress: string; amount: bigint }

type EncryptedNote = Awaited<ReturnType<DashPlatformSDK['shielded']['getShieldedEncryptedNotes']>>[number]

const SHIELDED_ACCOUNT = 0
// getShieldedEncryptedNotes requires startIndex to be chunk-aligned (a multiple
// of 2048); 8192 is the SDK max-per-query and a multiple of 2048, so advancing
// the cursor by full batches keeps every startIndex aligned.
const SHIELDED_SYNC_BATCH = 8192
const COIN_TYPE: Record<Network, number> = { mainnet: 5, testnet: 1 }
const WITHDRAWAL_CORE_FEE_PER_BYTE = 1
// Platform caps state transitions at ~20KB and the Halo2 proof grows with the
// number of Orchard actions, so spends are limited to 6 notes per transition.
const MAX_SPEND_NOTES = 6
const SPEND_FEE_CREDITS = 6_500_000n
// Notes spent before local bookkeeping existed (or by another install) are
// only detectable on-chain: a built transition exposes its action nullifiers,
// so stale selections are caught before broadcast and repaired by re-selecting.
const MAX_SPEND_ATTEMPTS = 3

export class ShieldedService {
  private sdk: DashPlatformSDK
  private walletDAO: WalletDAO
  private shieldedNoteDAO: ShieldedNoteDAO
  private warmupState: ShieldedWarmupState = 'idle'
  private warmupError: string | null = null
  private syncStates = new Map<string, ShieldedSyncState>()
  private spendStates = new Map<string, ShieldedSpendState>()
  private addresses = new Map<string, string>()

  constructor(sdk: DashPlatformSDK, walletDAO: WalletDAO, shieldedNoteDAO: ShieldedNoteDAO) {
    this.sdk = sdk
    this.walletDAO = walletDAO
    this.shieldedNoteDAO = shieldedNoteDAO
  }

  getStatus(): ShieldedStatus {
    if (this.warmupState === 'idle') {
      void this.warmUp()
    }
    return {
      warmup: this.warmupState,
      ready: this.warmupState === 'ready',
      error: this.warmupError
    }
  }

  async warmUp(): Promise<void> {
    if (this.warmupState === 'preparing' || this.warmupState === 'ready') return
    this.warmupState = 'preparing'
    this.warmupError = null
    try {
      await this.sdk.shielded.init()
      this.warmupState = 'ready'
    } catch (e) {
      this.warmupState = 'error'
      this.warmupError = e instanceof Error ? e.message : String(e)
      console.error('==================== [shielded] builder warm-up FAILED ====================')
      console.error(e)
      if (e instanceof Error) {
        console.error('[shielded] name   :', e.name)
        console.error('[shielded] message:', e.message)
        console.error('[shielded] stack  :', e.stack)
        const cause = (e as { cause?: unknown }).cause
        if (cause !== undefined) console.error('[shielded] cause  :', cause)
      } else {
        console.error('[shielded] non-Error thrown (type ' + typeof e + '):', e)
      }
      console.error('==========================================================================')
    }
  }

  async getAddress(walletId: string, password?: string): Promise<string | null> {
    const cached = this.addresses.get(walletId)
    if (cached != null) return cached
    if (password == null || password.length === 0) return null

    const wallet = await this.walletDAO.getWalletById(walletId)
    if (wallet == null) throw new Error('Wallet not found')

    let mnemonic: string
    try {
      mnemonic = decryptMnemonic(wallet.encryptedMnemonic, password)
    } catch {
      throw new Error('Invalid wallet password')
    }
    const seed = this.sdk.keyPair.mnemonicToSeed(mnemonic)
    return this.cacheAddress(walletId, seed, wallet.network)
  }

  private cacheAddress(walletId: string, seed: Uint8Array, network: Network): string {
    const address = this.sdk.keyPair.deriveShieldedAddress(seed, network, SHIELDED_ACCOUNT).toBech32m(network)
    this.addresses.set(walletId, address)
    return address
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

  startSync(walletId: string, password: string): ShieldedSyncState {
    const current = this.syncStates.get(walletId)
    if (current != null && (current.phase === 'syncing' || current.phase === 'recovering')) {
      return current
    }

    const state: ShieldedSyncState = {
      phase: 'syncing', fetched: 0, total: 0, balance: null, notes: [], error: null, syncedAt: null
    }
    this.syncStates.set(walletId, state)
    void this.runSync(walletId, password, state)
    return state
  }

  private async runSync(walletId: string, password: string, state: ShieldedSyncState): Promise<void> {
    try {
      const wallet = await this.walletDAO.getWalletById(walletId)
      if (wallet == null) throw new Error('Wallet not found')

      this.sdk.setNetwork(wallet.network)
      const mnemonic = decryptMnemonic(wallet.encryptedMnemonic, password)
      const seed = this.sdk.keyPair.mnemonicToSeed(mnemonic)
      this.cacheAddress(walletId, seed, wallet.network)

      const all = await this.fetchAllNotes((fetched, total) => {
        state.total = total
        state.fetched = fetched
      })

      state.phase = 'recovering'
      const recovered = this.sdk.shielded.recoverNotes(all, seed, SHIELDED_ACCOUNT)
      const spent = await this.shieldedNoteDAO.getSpentIndexes(walletId)

      let balance = 0n
      const notes: ShieldedNoteInfo[] = []
      for (const note of recovered) {
        const value = note.note.value
        const isSpent = spent.has(note.index)
        if (!isSpent) balance += value
        notes.push({ index: note.index, amount: value.toString(), spent: isSpent })
      }
      notes.sort((a, b) => b.index - a.index)

      state.balance = balance.toString()
      state.notes = notes
      state.phase = 'done'
      state.syncedAt = Date.now()
    } catch (e) {
      state.phase = 'error'
      state.error = e instanceof Error ? e.message : String(e)
      console.error('Shielded note sync failed', e)
    }
  }

  private async fetchAllNotes(onProgress: (fetched: number, total: number) => void): Promise<EncryptedNote[]> {
    const totalBig = await this.sdk.shielded.getShieldedNotesCount()
    const total = totalBig != null ? Number(totalBig) : 0
    onProgress(0, total)

    const all: EncryptedNote[] = []
    while (all.length < total) {
      const count = Math.min(SHIELDED_SYNC_BATCH, total - all.length)
      const batch = await this.sdk.shielded.getShieldedEncryptedNotes(BigInt(all.length), count)
      if (batch.length === 0) break
      all.push(...batch)
      onProgress(all.length, total)
    }
    return all
  }

  private idleSpendState(): ShieldedSpendState {
    return { phase: 'idle', fetched: 0, total: 0, stHash: null, error: null }
  }

  getSpendState(walletId: string): ShieldedSpendState {
    return this.spendStates.get(walletId) ?? this.idleSpendState()
  }

  startTransfer(walletId: string, password: string, recipient: string, amountCredits: bigint): ShieldedSpendState {
    return this.startSpend(walletId, password, { kind: 'transfer', recipient, amount: amountCredits })
  }

  startUnshield(walletId: string, password: string, outputAddress: string, amountCredits: bigint): ShieldedSpendState {
    return this.startSpend(walletId, password, { kind: 'unshield', outputAddress, amount: amountCredits })
  }

  startWithdrawal(walletId: string, password: string, coreAddress: string, amountCredits: bigint): ShieldedSpendState {
    return this.startSpend(walletId, password, { kind: 'withdrawal', coreAddress, amount: amountCredits })
  }

  private startSpend(walletId: string, password: string, request: SpendRequest): ShieldedSpendState {
    const current = this.spendStates.get(walletId)
    if (current != null && (current.phase === 'syncing' || current.phase === 'proving' || current.phase === 'broadcasting')) {
      return current
    }

    const state: ShieldedSpendState = { phase: 'syncing', fetched: 0, total: 0, stHash: null, error: null }
    this.spendStates.set(walletId, state)
    void this.runSpend(walletId, password, request, state)
    return state
  }

  private async runSpend(walletId: string, password: string, request: SpendRequest, state: ShieldedSpendState): Promise<void> {
    try {
      if (request.amount <= 0n) throw new Error('Amount must be greater than zero')

      const wallet = await this.walletDAO.getWalletById(walletId)
      if (wallet == null) throw new Error('Wallet not found')

      const network = wallet.network
      this.sdk.setNetwork(network)

      let mnemonic: string
      try {
        mnemonic = decryptMnemonic(wallet.encryptedMnemonic, password)
      } catch {
        throw new Error('Invalid wallet password')
      }
      const seed = this.sdk.keyPair.mnemonicToSeed(mnemonic)
      this.cacheAddress(walletId, seed, network)
      const coinType = COIN_TYPE[network]

      const all = await this.fetchAllNotes((fetched, total) => {
        state.total = total
        state.fetched = fetched
      })

      const recovered = this.sdk.shielded.recoverNotes(all, seed, SHIELDED_ACCOUNT)
      const changeAddress = this.sdk.keyPair.deriveShieldedAddress(seed, network, SHIELDED_ACCOUNT)
      const memo = ShieldedMemoWASM.empty() as unknown as string

      for (let attempt = 0; ; attempt++) {
        const spent = await this.shieldedNoteDAO.getSpentIndexes(walletId)
        const unspent = recovered.filter((note) => !spent.has(note.index))
        if (unspent.length === 0) throw new Error('No shielded notes available to spend')

        const selectable = unspent.map((note) => ({ index: note.index, value: note.note.value }))
        const selection = selectSpendNotes(selectable, request.amount + SPEND_FEE_CREDITS, MAX_SPEND_NOTES)
        if (selection == null) {
          const max = maxSpendableCredits(selectable, MAX_SPEND_NOTES, SPEND_FEE_CREDITS)
          throw new Error(
            `Amount needs more than ${MAX_SPEND_NOTES} notes (transaction size limit). ` +
            `Max per transaction right now: ${max.toLocaleString('en-US')} credits. ` +
            `Send a smaller amount, or consolidate notes by sending to your own shielded address.`
          )
        }
        const selectedIndexes = new Set(selection.selected.map((note) => note.index))
        const toSpend = unspent.filter((note) => selectedIndexes.has(note.index))

        const { spends, anchor } = this.sdk.shielded.buildSpendableNotes(all, toSpend)

        state.phase = 'proving'
        const base = { spends, changeAddress, seed, coinType, account: SHIELDED_ACCOUNT, anchor, memo }
        let stateTransition: StateTransitionWASM
        if (request.kind === 'transfer') {
          stateTransition = await this.sdk.shielded.createStateTransition('shieldedTransfer', {
            ...base,
            recipient: OrchardAddressWASM.fromBech32m(request.recipient),
            transferAmount: request.amount,
          })
        } else if (request.kind === 'unshield') {
          stateTransition = await this.sdk.shielded.createStateTransition('unshield', {
            ...base,
            outputAddress: request.outputAddress,
            unshieldAmount: request.amount,
          })
        } else {
          stateTransition = await this.sdk.shielded.createStateTransition('shieldedWithdrawal', {
            ...base,
            withdrawalAmount: request.amount,
            outputScript: coreAddressToScript(request.coreAddress, network),
            coreFeePerByte: WITHDRAWAL_CORE_FEE_PER_BYTE,
            pooling: 'Never',
          })
        }

        const nullifiers = this.extractActionNullifiers(stateTransition, request.kind)
        const statuses = await this.sdk.shielded.getShieldedNullifiers(nullifiers)
        if (statuses.some((status) => status.isSpent)) {
          if (attempt >= MAX_SPEND_ATTEMPTS - 1) {
            throw new Error('Selected notes were already spent on-chain. Re-sync your notes and try again.')
          }
          console.warn('[shielded] selection includes already-spent notes, probing', toSpend.map((n) => n.index))
          const stale = await this.probeSpentNotes(all, toSpend, seed, network)
          if (stale.length === 0) {
            throw new Error('An already-spent note was detected but could not be identified. Re-sync your notes and try again.')
          }
          await this.markNotesSpent(walletId, stale)
          console.warn('[shielded] marked stale notes as spent, retrying', stale)
          continue
        }

        const stBytes = stateTransition.bytes()
        console.log('[shielded] state transition ready', {
          kind: request.kind,
          spends: spends.length,
          sizeBytes: stBytes.length,
          hash: stateTransition.hash(false),
        })
        console.log('[shielded] state transition hex:\n' + stateTransition.hex())

        state.phase = 'broadcasting'
        await this.sdk.stateTransitions.broadcast(stateTransition)
        try {
          await this.markNotesSpent(walletId, toSpend.map((note) => note.index))
        } catch (e) {
          console.error('Failed to record spent shielded notes', e)
        }
        await this.waitForResult(stateTransition, request.kind)

        state.stHash = stateTransition.hash(false)
        state.phase = 'done'
        return
      }
    } catch (e) {
      state.phase = 'error'
      state.error = e instanceof Error ? e.message : String(e)
      console.error('Shielded spend failed', e)
    }
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

  private async waitForResult(st: StateTransitionWASM, kind: SpendRequest['kind']): Promise<void> {
    try {
      await this.sdk.stateTransitions.waitForStateTransitionResult(st)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      if (kind === 'withdrawal' && /withdrawals contract not available/i.test(message)) {
        console.warn('[shielded] withdrawal included; skipping local proof verification (SDK lacks withdrawals contract):', message)
        return
      }
      throw e
    }
  }

  private extractActionNullifiers(st: StateTransitionWASM, kind: SpendRequest['kind']): Uint8Array[] {
    const transition = kind === 'transfer'
      ? ShieldedTransferTransitionWASM.fromStateTransition(st)
      : kind === 'unshield'
        ? UnshieldTransitionWASM.fromStateTransition(st)
        : ShieldedWithdrawalTransitionWASM.fromStateTransition(st)
    return transition.actions.map((action) => action.nullifier)
  }

  // Identifies which of the candidate notes are already spent on-chain. Own
  // nullifiers can't be derived directly (no nullifier-key accessor in the
  // SDK), so each note is probed by proving a throwaway single-note
  // self-transfer — never broadcast — and checking its action nullifiers
  // against the pool. Dummy actions carry random nullifiers and read unspent.
  private async probeSpentNotes(
    all: EncryptedNote[],
    candidates: RecoveredNoteWASM[],
    seed: Uint8Array,
    network: Network,
  ): Promise<number[]> {
    const selfAddress = this.sdk.keyPair.deriveShieldedAddress(seed, network, SHIELDED_ACCOUNT)
    const spentIndexes: number[] = []
    for (const candidate of candidates) {
      let probe: StateTransitionWASM
      try {
        const { spends, anchor } = this.sdk.shielded.buildSpendableNotes(all, [candidate])
        probe = await this.sdk.shielded.createStateTransition('shieldedTransfer', {
          spends,
          changeAddress: selfAddress,
          seed,
          coinType: COIN_TYPE[network],
          account: SHIELDED_ACCOUNT,
          anchor,
          memo: ShieldedMemoWASM.empty() as unknown as string,
          recipient: selfAddress,
          transferAmount: 1n,
        })
      } catch (e) {
        console.warn('[shielded] note probe failed, skipping note', candidate.index, e)
        continue
      }
      const nullifiers = ShieldedTransferTransitionWASM.fromStateTransition(probe).actions.map((a) => a.nullifier)
      const statuses = await this.sdk.shielded.getShieldedNullifiers(nullifiers)
      if (statuses.some((status) => status.isSpent)) spentIndexes.push(candidate.index)
    }
    return spentIndexes
  }
}
