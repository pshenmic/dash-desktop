import { DashPlatformSDK } from 'dash-platform-sdk'
import { Network } from '../types'
import { WalletDAO } from '../database/WalletDAO'
import { decryptMnemonic } from '../utils'
import { OrchardAddressWASM, ShieldedMemoWASM, CoreScriptWASM, StateTransitionWASM } from 'pshenmic-dpp'
import { base58 } from '@scure/base'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'

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
const SHIELDED_SYNC_BATCH = 1000
const COIN_TYPE: Record<Network, number> = { mainnet: 5, testnet: 1 }
const WITHDRAWAL_CORE_FEE_PER_BYTE = 1
const BASE58_ADDRESS_LENGTH = 25

export class ShieldedService {
  private sdk: DashPlatformSDK
  private walletDAO: WalletDAO
  private warmupState: ShieldedWarmupState = 'idle'
  private warmupError: string | null = null
  private shieldedThreadsEnabled = false
  private syncStates = new Map<string, ShieldedSyncState>()
  private spendStates = new Map<string, ShieldedSpendState>()

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
      if (process.platform === 'win32') {
        try {
          await this.enableShieldedThreads()
        } catch (threadErr) {
          console.warn('[shielded] threaded-WASM workaround unavailable; attempting direct init', threadErr)
        }
      }
      this.sdk.shielded.init()
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

  // On platforms with no native pshenmic-dpp addon (e.g. Windows), the Halo2
  // builder runs in the emnapi WASM fallback, whose multithreading needs a
  // pre-warmed worker pool via an async-instantiated module. Load that threaded
  // module and swap it into pshenmic-dpp's global provider so the builder (and
  // all shielded WASM ops) use it instead of the single-threaded sync module.
  private async enableShieldedThreads(): Promise<void> {
    if (this.shieldedThreadsEnabled) return

    const require = createRequire(import.meta.url)
    const mainPath = require.resolve('pshenmic-dpp')
    const pkgDir = mainPath.slice(0, mainPath.lastIndexOf('pshenmic-dpp') + 'pshenmic-dpp'.length)
    const loaderUrl = pathToFileURL(join(pkgDir, 'dist', 'binaries', 'wasmThreaded.cjs')).href
    const providerUrl = pathToFileURL(join(pkgDir, 'dist', 'src', 'dpp', 'provider.js')).href

    const loaderModule = await import(loaderUrl)
    const loadThreaded = loaderModule.loadThreaded ?? loaderModule.default?.loadThreaded
    if (typeof loadThreaded !== 'function') {
      throw new Error('pshenmic-dpp threaded WASM loader (wasmThreaded.cjs) not found')
    }
    const threaded = await loadThreaded()

    const providerModule = await import(providerUrl)
    providerModule.dppProvider.setDpp(threaded)
    this.shieldedThreadsEnabled = true
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

      const all = await this.fetchAllNotes((fetched, total) => {
        state.total = total
        state.fetched = fetched
      })

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

  private coreAddressToScript(coreAddress: string): CoreScriptWASM {
    const decoded = base58.decode(coreAddress)
    if (decoded.length !== BASE58_ADDRESS_LENGTH) {
      throw new Error(`Invalid Core address: ${coreAddress}`)
    }
    return CoreScriptWASM.newP2PKH(decoded.slice(1, 21))
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
      const coinType = COIN_TYPE[network]

      const all = await this.fetchAllNotes((fetched, total) => {
        state.total = total
        state.fetched = fetched
      })

      const recovered = this.sdk.shielded.recoverNotes(all, seed, SHIELDED_ACCOUNT)
      if (recovered.length === 0) throw new Error('No shielded notes available to spend')

      const { spends, anchor } = this.sdk.shielded.buildSpendableNotes(all, recovered)
      const changeAddress = this.sdk.keyPair.deriveShieldedAddress(seed, network, SHIELDED_ACCOUNT)
      const memo = ShieldedMemoWASM.empty() as unknown as string

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
          outputScript: this.coreAddressToScript(request.coreAddress),
          coreFeePerByte: WITHDRAWAL_CORE_FEE_PER_BYTE,
          pooling: 'Standard',
        })
      }

      state.phase = 'broadcasting'
      await this.sdk.stateTransitions.broadcast(stateTransition)
      await this.sdk.stateTransitions.waitForStateTransitionResult(stateTransition)

      state.stHash = stateTransition.hash(false)
      state.phase = 'done'
    } catch (e) {
      state.phase = 'error'
      state.error = e instanceof Error ? e.message : String(e)
      console.error('Shielded spend failed', e)
    }
  }
}
