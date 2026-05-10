import {ChainDAO, ChainTipState, PersistedHeader} from './database/ChainDAO'
import {Network} from '../src/types'

// Single-owner facade over chain storage. All workers read/write chain state
// through this — never reach into ChainDAO directly.
//
// chain storage now holds ONLY network-scoped data (headers, hash cache, filter
// headers). Wallet-scoped state (UTXOs, transactions, cfilter cursor) lives
// in the SQL database in the main process — see TransactionDAO. The split
// keeps chain storage free of anything that needs to be encrypted under the
// user's key when SQLCipher lands.
export class ChainStore {
  constructor(private readonly chainDAO: ChainDAO, readonly network: Network) {}

  open = (): Promise<void> => this.chainDAO.open()
  close = (): Promise<void> => this.chainDAO.close()

  // ── Header chain ───────────────────────────────────────────────────────────
  initSyncState = (): Promise<ChainTipState> => this.chainDAO.initSyncState(this.network)
  appendHeaders = (headers: PersistedHeader[], next: ChainTipState): Promise<void> =>
    this.chainDAO.appendHeaders(this.network, headers, next)
  getHeaderByHeight = (height: number): Promise<Uint8Array | null> =>
    this.chainDAO.getHeaderByHeight(height)
  iterateHeadersInRange = (from: number, to: number) =>
    this.chainDAO.iterateHeadersInRange(from, to)

  // ── Hash cache ─────────────────────────────────────────────────────────────
  iterateHashesInRange = (from: number, to: number) =>
    this.chainDAO.iterateHashesInRange(from, to)
  writeBackfillHashes = (entries: Array<{ height: number; wire: Uint8Array }>): Promise<void> =>
    this.chainDAO.writeBackfillHashes(entries)

  // ── Filter-header cache ────────────────────────────────────────────────────
  iterateFilterHeadersInRange = (from: number, to: number) =>
    this.chainDAO.iterateFilterHeadersInRange(from, to)
  writeFilterHeaders = (entries: Array<{ height: number; header: Uint8Array }>): Promise<void> =>
    this.chainDAO.writeFilterHeaders(entries)
  deleteFilterHeadersFrom = (fromHeight: number): Promise<void> =>
    this.chainDAO.deleteFilterHeadersFrom(fromHeight)
}
