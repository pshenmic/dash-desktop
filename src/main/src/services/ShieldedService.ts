import { DashPlatformSDK } from 'dash-platform-sdk'
import { Network } from '../types'
import { WalletDAO } from '../database/WalletDAO'
import { decryptMnemonic } from '../utils'

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

type EncryptedNote = Awaited<ReturnType<DashPlatformSDK['shielded']['getShieldedEncryptedNotes']>>[number]

const SHIELDED_ACCOUNT = 0
const SHIELDED_SYNC_BATCH = 1000

export class ShieldedService {
  private sdk: DashPlatformSDK
  private walletDAO: WalletDAO
  private warmupState: ShieldedWarmupState = 'idle'
  private warmupError: string | null = null
  private syncStates = new Map<string, ShieldedSyncState>()

  constructor(sdk: DashPlatformSDK, walletDAO: WalletDAO) {
    this.sdk = sdk
    this.walletDAO = walletDAO
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
      await new Promise<void>((resolve) => setImmediate(resolve))
      this.sdk.shielded.init()
      this.warmupState = 'ready'
    } catch (e) {
      this.warmupState = 'error'
      this.warmupError = e instanceof Error ? e.message : String(e)
      console.error('Shielded builder warm-up failed', e)
    }
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

      const totalBig = await this.sdk.shielded.getShieldedNotesCount()
      const total = totalBig != null ? Number(totalBig) : 0
      state.total = total

      const all: EncryptedNote[] = []
      while (all.length < total) {
        const count = Math.min(SHIELDED_SYNC_BATCH, total - all.length)
        const batch = await this.sdk.shielded.getShieldedEncryptedNotes(BigInt(all.length), count)
        if (batch.length === 0) break
        all.push(...batch)
        state.fetched = all.length
      }

      state.phase = 'recovering'
      const recovered = this.sdk.shielded.recoverNotes(all, seed, SHIELDED_ACCOUNT)

      let balance = 0n
      const notes: ShieldedNoteInfo[] = []
      for (const note of recovered) {
        const value = note.note.value
        balance += value
        notes.push({ index: note.index, amount: value.toString() })
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
}
