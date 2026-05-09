import {ChainDAO, ChainTipState, PersistedHeader, PersistedUtxo} from './ChainDAO'
import {Network} from '../src/types'

// Single-owner facade over chain.db. All workers read/write chain state
// through this — never reach into ChainDAO directly. Today this is a thin
// pass-through to LevelDB; future refactor will split the surface in two:
//
//   - chain data (headers, hash cache, filter headers, cfheader checkpoints)
//     stays in LevelDB (network-scoped, public, no encryption needed)
//   - wallet data (UTXOs, cursor) moves to SQLCipher-backed SQLite under
//     the user's derived key (sensitive, must not be readable pre-unlock)
//
// Keeping this facade lets us swap the wallet-data backend without touching
// any worker code.
export class ChainStore {
  constructor(private readonly chainDAO: ChainDAO, readonly network: Network) {}

  open = (): Promise<void> => this.chainDAO.open()
  close = (): Promise<void> => this.chainDAO.close()

  // ── Header chain (network-scoped, LevelDB) ─────────────────────────────────
  initSyncState = (): Promise<ChainTipState> => this.chainDAO.initSyncState(this.network)
  appendHeaders = (headers: PersistedHeader[], next: ChainTipState): Promise<void> =>
    this.chainDAO.appendHeaders(this.network, headers, next)
  getHeaderByHeight = (height: number): Promise<Uint8Array | null> =>
    this.chainDAO.getHeaderByHeight(height)
  iterateHeadersInRange = (from: number, to: number) =>
    this.chainDAO.iterateHeadersInRange(from, to)

  // ── Hash cache (network-scoped, LevelDB) ───────────────────────────────────
  iterateHashesInRange = (from: number, to: number) =>
    this.chainDAO.iterateHashesInRange(from, to)
  writeBackfillHashes = (entries: Array<{ height: number; wire: Uint8Array }>): Promise<void> =>
    this.chainDAO.writeBackfillHashes(entries)

  // ── Filter-header cache (network-scoped, LevelDB) ──────────────────────────
  iterateFilterHeadersInRange = (from: number, to: number) =>
    this.chainDAO.iterateFilterHeadersInRange(from, to)
  writeFilterHeaders = (entries: Array<{ height: number; header: Uint8Array }>): Promise<void> =>
    this.chainDAO.writeFilterHeaders(entries)
  deleteFilterHeadersFrom = (fromHeight: number): Promise<void> =>
    this.chainDAO.deleteFilterHeadersFrom(fromHeight)

  // ── Wallet-scoped state (will move to SQL) ─────────────────────────────────
  // Marked separately so the future sqlcipher migration knows what to extract.
  getAllUtxos = (walletId: string): Promise<PersistedUtxo[]> =>
    this.chainDAO.getAllUtxos(walletId)
  applyBlockUtxos = (
    walletId: string,
    spends: Array<{ txid: string; vout: number }>,
    received: PersistedUtxo[],
    cursorHeight: number,
  ): Promise<void> =>
    this.chainDAO.applyBlockUtxos(walletId, spends, received, cursorHeight)
  getCFilterCursor = (walletId: string): Promise<number | null> =>
    this.chainDAO.getCFilterCursor(walletId)
  setCFilterCursor = (walletId: string, height: number): Promise<void> =>
    this.chainDAO.setCFilterCursor(walletId, height)
}