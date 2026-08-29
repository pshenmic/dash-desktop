import { OrchardAddressWASM } from 'pshenmic-dpp'
import { Network } from '../../types/Network'
import { WalletDAO } from '../../database/WalletDAO'
import { IdentityDAO } from '../../database/IdentityDAO'
import { ShieldedNoteDAO } from '../../database/ShieldedNoteDAO'
import { ShieldedPoolDAO } from '../../database/ShieldedPoolDAO'
import { ShieldedAddressDAO } from '../../database/ShieldedAddressDAO'
import { AssetLockFundingState } from '../../types/AssetLockFunding'
import {AssetLockService} from './AssetLockService'
import { unlockWallet, withUnlockedWallet, zeroSeed } from '../../utils/walletSeed'
import { UnlockedWallet } from '../../types/UnlockedWallet'
import { Wallet } from '../../types/Wallet'
import {SHIELDED_ADDRESS_WINDOW} from '../../constants/addresses'
import {SHIELDED_NOTES_FETCH_BATCH, SHIELD_FUNDING_FEE_RESERVE_CREDITS} from '../../constants/credits'
import { findNextIdentityIndex, identityPath } from '../../utils/identityKeys'
import {coreFeePerByte} from '../../utils/coreFeeRate'
import {platformAccountXpub, platformAddressDeriver} from '../../utils/platformAddress'
import {shieldedAddressDeriver} from '../../utils/shieldedAddress'
import {runAddressWindow} from '../../utils/addressWindow'
import {AddressWindowStore, DerivedAddress, UsageOracle} from '../../types/AddressWindow'
import {ShieldedAddressRow} from '../../types/ShieldedAddress'
import {Preferences} from '../../preferences'
import { lockedDuffsFor, shieldAmountFromLockedDuffs } from '../../utils/assetLockTx'
import { PlatformWorkerService } from './PlatformWorkerService'
import {
  ShieldedNoteInfo,
  ShieldedPoolInfo,
  ShieldedNotesInfo,
  ShieldedSpendPhase,
  ShieldedSpendState,
  ShieldedStatus,
  ShieldedSyncPhase,
  ShieldedSyncState,
} from '../../types/Shielded'
import {OperationFee} from '../../types/Fee'
import {maxSpendableCredits, selectSpendNotes} from '../../utils/shieldedNoteSelection'
import {requireWallet} from '../../utils/requireWallet'
import {
  EncryptedNotePayload,
  PlatformPayload,
  PlatformPhase,
  PoolSpendOperation,
} from '../../../platform/types/messages'
import {AssetLockFundingRow, AcquiredAssetLock} from '../../types/AssetLock'

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


// Wallet-domain layer over the platform worker's shielded operations: owns
// unlocking, display-address derivation, per-wallet sync/spend state and the
// note DAOs. Anything CPU- or network-bound is a PlatformWorkerService request.
export class ShieldedService {
  private walletDAO: WalletDAO
  private identityDAO: IdentityDAO
  private shieldedNoteDAO: ShieldedNoteDAO
  private shieldedPoolDAO: ShieldedPoolDAO
  private shieldedAddressDAO: ShieldedAddressDAO
  private platform: PlatformWorkerService
  private assetLock: AssetLockService
  private preferences: Preferences
  private syncStates = new Map<string, ShieldedSyncState>()
  private spendStates = new Map<string, ShieldedSpendState>()
  private addresses = new Map<string, string[]>()
  private noteFetches = new Map<Network, Promise<void>>()
  private feeCurves = new Map<string, bigint[]>()
  private addQueue = new Map<string, Promise<unknown>>()

  constructor(walletDAO: WalletDAO, identityDAO: IdentityDAO, shieldedNoteDAO: ShieldedNoteDAO, shieldedPoolDAO: ShieldedPoolDAO, shieldedAddressDAO: ShieldedAddressDAO, platform: PlatformWorkerService, assetLock: AssetLockService, preferences: Preferences) {
    this.walletDAO = walletDAO
    this.identityDAO = identityDAO
    this.shieldedNoteDAO = shieldedNoteDAO
    this.shieldedPoolDAO = shieldedPoolDAO
    this.shieldedAddressDAO = shieldedAddressDAO
    this.platform = platform
    this.assetLock = assetLock
    this.preferences = preferences
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
    if (persisted.length > 0) return this.cacheList(walletId, persisted)

    if (password == null || password.length === 0) return null

    return withUnlockedWallet(this.walletDAO, walletId, password, ({wallet: {network}, seed}) =>
      this.revealWindow(walletId, seed, network))
  }

  // Serialised per wallet rather than joined: two clicks should reveal two
  // addresses, but the second has to read the count the first wrote or one of
  // them is silently lost.
  async addAddress(walletId: string, password: string): Promise<string[]> {
    const prior = this.addQueue.get(walletId) ?? Promise.resolve()
    const run = prior.catch(() => {}).then(() => this.revealNextAddress(walletId, password))
    this.addQueue.set(walletId, run)
    try {
      return await run
    } finally {
      if (this.addQueue.get(walletId) === run) this.addQueue.delete(walletId)
    }
  }

  // One index past the frontier. The walk already extended the window so a full
  // gap of unused diversifiers follows the last used one, which is what makes
  // the next index safe to hand out without re-checking it.
  private revealNextAddress(walletId: string, password: string): Promise<string[]> {
    return withUnlockedWallet(this.walletDAO, walletId, password, async ({wallet: {network}, seed}) => {
      // The used flags come from decrypted notes, so a wallet behind the pool
      // cannot tell a fresh diversifier from one that already received. Revealing
      // on that answer is how a restored wallet hands out an address twice.
      if (await this.undecodedCount(walletId, network) > 0) {
        throw new Error('Sync the shielded pool before revealing a new address')
      }

      const rows = await this.shieldedAddressDAO.getAddresses(walletId)
      const next = rows.reduce((max, row) => Math.max(max, row.index), -1) + 1
      const derived = shieldedAddressDeriver(seed, network).derive(next)
      await this.shieldedAddressDAO.insertAddresses([this.addressRow(walletId, derived)])

      return this.revealWindow(walletId, seed, network)
    })
  }

  // The same gap walk L1 and platform run. The oracle is the decrypted-note set
  // rather than a chain query, and the deriver needs the seed — ZIP-32 has no
  // watch-only key — so this only ever runs inside an already-unlocked
  // operation, on the seed that operation is holding anyway.
  private async revealWindow(walletId: string, seed: Uint8Array, network: Network): Promise<string[]> {
    await runAddressWindow(
      shieldedAddressDeriver(seed, network),
      this.shieldedOracle(walletId),
      this.shieldedStore(walletId),
      SHIELDED_ADDRESS_WINDOW,
    )
    return this.cacheList(walletId, await this.shieldedAddressDAO.getAddresses(walletId))
  }

  // Every diversified address of the account shares one incoming viewing key, so
  // a note proves its own address was used and nothing has to be asked of the
  // network.
  private shieldedOracle(walletId: string): UsageOracle {
    let used: Set<string> | null = null
    return {
      scan: async () => null,
      probe: async addresses => {
        used ??= await this.shieldedNoteDAO.getUsedAddresses(walletId)
        return addresses.map(entry => ({index: entry.index, isUsed: used!.has(entry.address)}))
      },
    }
  }

  private shieldedStore(walletId: string): AddressWindowStore {
    return {
      known: async () => {
        const rows = await this.shieldedAddressDAO.getAddresses(walletId)
        return rows.map(row => ({index: row.index, isUsed: row.isUsed}))
      },
      reveal: addresses => this.shieldedAddressDAO.insertAddresses(
        addresses.map(derived => this.addressRow(walletId, derived)),
      ),
      markUsed: indexes => this.shieldedAddressDAO.markAddressesUsed(walletId, indexes),
    }
  }

  private addressRow(walletId: string, derived: DerivedAddress): ShieldedAddressRow {
    return {
      walletId,
      index: derived.index,
      address: derived.address,
      isUsed: false,
    }
  }

  private cacheList(walletId: string, rows: ShieldedAddressRow[]): string[] {
    const list = rows.map(row => row.address)
    this.addresses.set(walletId, list)
    return list
  }

  async getPoolInfo(network: Network): Promise<ShieldedPoolInfo> {
    const {poolState, notesCount} = await this.platform.request('poolInfo', network, {})
    return {
      poolState,
      notesCount,
    }
  }

  // No password needed — the payloads are network state, trial-decrypted later
  // when the user unlocks a sync. Deduped per network, so wallets sharing one
  // share the download.
  private checkForNewNotes(network: Network, onProgress?: (fetched: number, total: number) => void): Promise<void> {
    const inFlight = this.noteFetches.get(network)
    if (inFlight != null) return inFlight
    const fetch = this.fetchNewNotes(network, onProgress)
      .finally(() => this.noteFetches.delete(network))
    this.noteFetches.set(network, fetch)
    return fetch
  }

  // Cannot detect incoming notes on its own — that needs trial-decryption, so a
  // password — which is why a wallet that never opened the feature polls nothing.
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
    return {undecodedCount: await this.undecodedCount(walletId, wallet.network)}
  }

  // How far this wallet is behind the pool. Decoding always runs as a prefix, so
  // anything above the cursor is a note it has never trial-decrypted.
  private async undecodedCount(walletId: string, network: Network): Promise<number> {
    const stored = await this.shieldedPoolDAO.getCount(network)
    const decoded = await this.walletDAO.getShieldedDecodedCount(walletId)
    return Math.max(stored - decoded, 0)
  }

  private idleSyncState(): ShieldedSyncState {
    return { phase: 'idle', fetched: 0, total: 0, balance: null, notes: [], error: null, syncedAt: null }
  }

  getSyncState(walletId: string): ShieldedSyncState {
    return this.syncStates.get(walletId) ?? this.idleSyncState()
  }

  // Returns the in-flight state when a sync is already running for this wallet,
  // otherwise installs a fresh one.
  private beginSync(walletId: string): {state: ShieldedSyncState; running: boolean} {
    const current = this.syncStates.get(walletId)
    if (current != null && (current.phase === 'syncing' || current.phase === 'recovering')) {
      return {state: current, running: true}
    }
    const state: ShieldedSyncState = {
      phase: 'syncing', fetched: 0, total: 0, balance: null, notes: [], error: null, syncedAt: null
    }
    this.syncStates.set(walletId, state)
    return {state, running: false}
  }

  async startSync(walletId: string, password: string): Promise<ShieldedSyncState> {
    const {state, running} = this.beginSync(walletId)
    if (running) return state

    let unlocked: UnlockedWallet | null = null
    try {
      unlocked = await unlockWallet(this.walletDAO, walletId, password)
      const {wallet: {network}, seed} = unlocked

      // The scan outlives this method, so it owns the seed and zeroes it however
      // it settles.
      const held = unlocked
      this.syncNotes(walletId, network, seed, state)
        .catch(e => this.failed(state, e))
        .finally(() => zeroSeed(held))
    } catch (e) {
      if (unlocked != null) zeroSeed(unlocked)
      this.failed(state, e)
    }
    return state
  }

  // A spend's change note and a shield's new note are indistinguishable from
  // anyone else's until they are trial-decrypted, so a refresh that holds no
  // seed leaves the balance stale and the note list short. Never rejects: the
  // outcome belongs to the sync state, and callers run inside jobs that would
  // otherwise report their own success as a failure.
  async refreshNotes(walletId: string, network: Network, seed: Uint8Array): Promise<void> {
    const {state, running} = this.beginSync(walletId)
    if (running) return

    try {
      await this.syncNotes(walletId, network, seed, state)
    } catch (e) {
      this.failed(state, e)
    }
  }

  private settleSync(state: ShieldedSyncState, notes: ShieldedNoteInfo[]): void {
    let balance = 0n
    for (const note of notes) {
      if (!note.spent) balance += note.amount
    }
    state.balance = balance
    state.notes = notes
    state.phase = 'done'
    state.syncedAt = Date.now()
  }

  private async syncNotes(
    walletId: string,
    network: Network,
    seed: Uint8Array,
    state: ShieldedSyncState,
  ): Promise<void> {
    await this.checkForNewNotes(network, (fetched, total) => {
      state.fetched = fetched
      state.total = total
    })

    const priorNotes = await this.shieldedNoteDAO.getOwnedNotes(walletId)
    const decodedFrom = await this.walletDAO.getShieldedDecodedCount(walletId)
    const fresh = await this.shieldedPoolDAO.getEncryptedNotesFrom(network, decodedFrom)

    if (fresh.length === 0) {
      this.settleSync(state, priorNotes)
      await this.revealWindow(walletId, seed, network)
      return
    }

    const owned = await this.shieldedPoolDAO.getEncryptedNotes(network, priorNotes.map(note => note.index))
    const decodedUpTo = fresh[fresh.length - 1].index + 1
    const result = await this.platform.request('sync', network, {seed, notes: [...owned, ...fresh]}, {
      onProgress: phase => { state.phase = syncPhase(phase) ?? state.phase },
    })

    const all: ShieldedNoteInfo[] = result.notes.map(note => ({
      index: note.index,
      amount: note.amount,
      spent: note.spent,
      address: note.address,
    })).sort((a, b) => b.index - a.index)
    this.settleSync(state, all)
    await this.shieldedNoteDAO.upsertNotes(walletId, all)
    await this.walletDAO.setShieldedDecodedCount(walletId, decodedUpTo)

    // Only now can the window be judged: it reads used flags off the notes this
    // sync just wrote. Runs on the seed the sync is already holding, and is done
    // with it before the caller zeroes it.
    await this.revealWindow(walletId, seed, network)
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
    return this.startSpend(walletId, password, 'shieldedTransfer', recipient, amountCredits, noteIndexes)
  }

  startUnshield(walletId: string, password: string, outputAddress: string, amountCredits: bigint, noteIndexes?: number[]): Promise<ShieldedSpendState> {
    return this.startSpend(walletId, password, 'unshield', outputAddress, amountCredits, noteIndexes)
  }

  startWithdrawal(walletId: string, password: string, coreAddress: string, amountCredits: bigint, noteIndexes?: number[]): Promise<ShieldedSpendState> {
    return this.startSpend(walletId, password, 'shieldedWithdrawal', coreAddress, amountCredits, noteIndexes)
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

  private async startSpend(walletId: string, password: string, kind: PoolSpendOperation, recipient: string, amountCredits: bigint, noteIndexes?: number[]): Promise<ShieldedSpendState> {
    const {state, running} = this.beginSpend(walletId)
    if (running) return state

    let unlocked: UnlockedWallet | null = null
    try {
      if (amountCredits <= 0n) throw new Error('Amount must be greater than zero')

      unlocked = await unlockWallet(this.walletDAO, walletId, password)
      const {wallet: {network}, seed} = unlocked
      await this.revealWindow(walletId, seed, network)
      const notes = await this.loadSpendNotes(network, state)

      // runSpend owns the seed from here — proving runs for minutes past this
      // method, and it zeroes on settlement.
      this.runSpend(walletId, network, state, {
        seed,
        kind,
        recipient,
        amountCredits,
        notes,
        noteIndexes: noteIndexes ?? null,
        identityIndex: null,
        failureAddress: null,
        coreFeePerByte: coreFeePerByte(this.preferences.general.coreFeeMultiplier),
      })
    } catch (e) {
      if (unlocked != null) zeroSeed(unlocked)
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
    }).then(async result => {
      state.stHash = result.stHash
      state.identityId = result.identityId
      state.phase = 'done'
      // Awaited: the seed is zeroed the moment this chain settles, and the
      // refresh trial-decrypts with it.
      await this.refreshNotes(walletId, network, payload.seed)
      if (identityCreate != null && result.identityId != null) {
        this.persistCreatedIdentity({walletId, network, ...identityCreate}, result.identityId).catch(e =>
          console.error('Failed to persist identity created from the shielded pool', e))
      }
    }).catch(e => this.failed(state, e))
      .finally(() => zeroSeed(payload))
  }

  async startIdentityCreate(walletId: string, password: string, denominationCredits: bigint): Promise<ShieldedSpendState> {
    const {state, running} = this.beginSpend(walletId)
    if (running) return state

    let unlocked: UnlockedWallet | null = null
    try {
      if (denominationCredits <= 0n) throw new Error('Amount must be greater than zero')

      unlocked = await unlockWallet(this.walletDAO, walletId, password)
      const {wallet, seed} = unlocked
      const network = wallet.network
      await this.revealWindow(walletId, seed, network)
      const notes = await this.loadSpendNotes(network, state)

      const localIdentities = await this.identityDAO.getIdentitiesByWalletId(walletId)
      const startIndex = localIdentities.reduce((max, identity) => Math.max(max, identity.identityIndex + 1), 0)
      const identityIndex = await findNextIdentityIndex(this.platform, seed, startIndex, network)

      const xpub = await platformAccountXpub(this.walletDAO, wallet, seed)
      const failureAddress = platformAddressDeriver(xpub, network).derive(0).address

      this.runSpend(walletId, network, state, {
        seed,
        kind: 'identityCreateFromShielded',
        recipient: '',
        amountCredits: denominationCredits,
        notes,
        noteIndexes: null,
        identityIndex,
        failureAddress,
        coreFeePerByte: coreFeePerByte(this.preferences.general.coreFeeMultiplier),
      }, {identityIndex})
    } catch (e) {
      if (unlocked != null) zeroSeed(unlocked)
      this.failed(state, e)
    }
    return state
  }

  // Locks L1 coins and shields the credits straight into the pool, so they
  // never sit on a transparent platform address.
  async startShieldFromL1(walletId: string, recipient: string, amountDuffs: bigint, password: string): Promise<AssetLockFundingState> {
    const destination = recipient.trim()
    if (destination.length === 0) {
      throw new Error('Shielded recipient address is required')
    }
    try {
      OrchardAddressWASM.fromBech32m(destination)
    } catch {
      throw new Error('Invalid shielded recipient address')
    }

    const unlocked = await unlockWallet(this.walletDAO, walletId, password)
    const {wallet, seed} = unlocked
    try {
      // The reserve is what settleShield subtracts again, so the amount asked for
      // is the amount that reaches the pool.
      const lockDuffs = lockedDuffsFor(amountDuffs, SHIELD_FUNDING_FEE_RESERVE_CREDITS)
      const state = await this.assetLock.begin(walletId, 'shielded', destination, lockDuffs)
      return this.runFunding(state, unlocked, async () => {
        const acquired = await this.assetLock.acquire(state, {
          walletId, kind: 'shielded', destination, amountDuffs: lockDuffs, seed,
        })
        await this.settleShield(wallet, seed, state, acquired)
      })
    } catch (error) {
      zeroSeed(unlocked)
      throw error
    }
  }

  async resumeShieldFromL1(walletId: string, row: AssetLockFundingRow, password: string): Promise<AssetLockFundingState> {
    const unlocked = await unlockWallet(this.walletDAO, walletId, password)
    const {wallet, seed} = unlocked

    const state = this.assetLock.resume(walletId, row)
    return this.runFunding(state, unlocked, async () => {
      const acquired = await this.assetLock.reacquire(state, row)
      await this.settleShield(wallet, seed, state, acquired)
    })
  }

  // The job runs on past the method that started it, so it holds the seed and
  // zeroes it however it settles.
  private runFunding(state: AssetLockFundingState, unlocked: {seed: Uint8Array}, work: () => Promise<void>): AssetLockFundingState {
    void work()
      .catch(error => this.assetLock.fail(state, error))
      .finally(() => zeroSeed(unlocked))
    return state
  }

  private async settleShield(
    wallet: Wallet,
    seed: Uint8Array,
    state: AssetLockFundingState,
    {row, proof}: AcquiredAssetLock,
  ): Promise<void> {
    await this.assetLock.markBroadcastingSt(state, row)

    const xpub = await platformAccountXpub(this.walletDAO, wallet, seed)
    const surplus = platformAddressDeriver(xpub, wallet.network).derive(0)
    const {stHash} = await this.platform.request('shieldFromAssetLock', wallet.network, {
      seed,
      txid: row.txid,
      outputIndex: row.outputIndex,
      assetLockProof: proof,
      creditDerivationPath: row.creditDerivationPath,
      recipient: row.toPlatformAddress,
      shieldAmountCredits: shieldAmountFromLockedDuffs(row.amountDuffs),
      surplusAddress: surplus.address,
    })

    await this.assetLock.done(state, row, stHash)
    // Awaited: runFunding zeroes the seed the moment this settles.
    await this.refreshNotes(wallet.walletId, wallet.network, seed)
  }

  // The fee and the note count define each other: the fee scales with how many
  // notes are spent, and covering a larger fee can pull in another note. The
  // spend resolves that with these same two helpers over these same values, so
  // quoting it anywhere else would be a second implementation of the answer.
  async estimateSpendFee(
    walletId: string,
    kind: PoolSpendOperation,
    amountCredits: bigint,
    noteIndexes: number[] | null,
  ): Promise<OperationFee> {
    const wallet = await requireWallet(this.walletDAO, walletId)
    const curve = await this.spendFeeCurve(wallet.network, kind)
    const feeForCount = (numSpends: number): bigint => curve[Math.min(numSpends, curve.length) - 1]

    const candidates = (this.syncStates.get(walletId)?.notes ?? [])
      .filter(note => !note.spent && (noteIndexes == null || noteIndexes.includes(note.index)))
      .map(note => ({index: note.index, value: note.amount}))

    const selection = amountCredits > 0n
      ? selectSpendNotes(candidates, amountCredits, curve.length, feeForCount)
      : null

    return {
      feeCredits: selection?.feeCredits ?? feeForCount(1),
      feeDuffs: null,
      maxDuffs: null,
      maxPerTx: maxSpendableCredits(candidates, curve.length, feeForCount),
      noteLimit: curve.length,
    }
  }

  // Fixed per network and spend kind: the protocol minimum for each note count.
  private async spendFeeCurve(network: Network, kind: PoolSpendOperation): Promise<bigint[]> {
    const key = `${network}:${kind}`
    const cached = this.feeCurves.get(key)
    if (cached != null) return cached

    const {feeCredits} = await this.platform.request('spendFeeCurve', network, {kind})
    this.feeCurves.set(key, feeCredits)
    return feeCredits
  }

  private async markNotesSpent(walletId: string, indexes: number[]): Promise<void> {
    await this.shieldedNoteDAO.markSpent(walletId, indexes)
    const sync = this.syncStates.get(walletId)
    if (sync == null || sync.phase !== 'done') return
    const spent = new Set(indexes)
    let balance = sync.balance ?? 0n
    for (const note of sync.notes) {
      if (!note.spent && spent.has(note.index)) {
        note.spent = true
        balance -= note.amount
      }
    }
    sync.balance = balance > 0n ? balance : 0n
  }

}
