import {EventEmitter} from 'events'
import {Message, Messages, NODE_COMPACT_FILTERS, Peer, Pool} from 'dash-core-p2p'
import {Network} from '../src/types'
import {HEADER_RACE_PEERS, POOL_MAX_SIZE, POOL_REFILL_INTERVAL_MS} from './constants'

// Shared peer pool for all workers in the utility process. Tracks ready
// peers and the +CF subset; re-emits the dash-core-p2p Pool events through
// a typed EventEmitter so multiple workers can subscribe independently.
//
// Workers MUST NOT instantiate their own Pool — having parallel pools
// fights for the same peer addresses, doubles socket usage, and makes
// peer-state coordination (which peers serve filters, who's the leader)
// impossible. One pool, many subscribers.

export interface PoolServiceEventMap {
  peerconnect: (peer: Peer) => void
  peerready: (peer: Peer) => void
  peerdisconnect: (peer: Peer) => void
  peerversion: (peer: Peer, message: Message & { services?: bigint }) => void
  peerheaders: (peer: Peer, message: Message & { headers?: Uint8Array[] }) => void
  peerinv: (peer: Peer, message: Message & { inventory?: Array<{ type: number; hash: Uint8Array }> }) => void
  peerblock: (peer: Peer, message: Message & { block?: unknown }) => void
  peercfcheckpt: (peer: Peer, message: Message) => void
  peercfheaders: (peer: Peer, message: Message) => void
  peercfilter: (peer: Peer, message: Message) => void
  peerislock: (peer: Peer, message: Message & { txid?: string }) => void
  peerisdlock: (peer: Peer, message: Message & { txid?: string }) => void
  peerclsig: (peer: Peer, message: Message & { height?: number; blockHash?: string }) => void
  seederror: (err: Error) => void
}

const FORWARDED_EVENTS: Array<keyof PoolServiceEventMap> = [
  'peerconnect', 'peerready', 'peerdisconnect', 'peerversion',
  'peerheaders', 'peerinv', 'peerblock',
  'peercfcheckpt', 'peercfheaders', 'peercfilter',
  'peerislock', 'peerisdlock', 'peerclsig',
  'seederror',
]

export class PoolService extends EventEmitter {
  readonly network: Network
  readonly messages: Messages
  readonly pool: Pool
  readonly readyPeers = new Set<Peer>()
  readonly filterCapablePeers = new Set<Peer>()
  readonly peerServices = new WeakMap<Peer, bigint>()

  private refillTimer: ReturnType<typeof setInterval> | null = null
  private stopped = false

  constructor(network: Network) {
    super()
    this.network = network
    this.messages = new Messages({network} as never)
    // dnsSeed: true lets us self-bootstrap. relay: true is required for
    // InstantSend: Dash Core gates ISLOCK/ISDLOCK inv behind the peer's tx-relay
    // preference (fRelayTxes), so relay: false means we never receive lock inv
    // and instant-send confirmation can never fire. We do NOT fetch tx bodies
    // for the mempool inv this lets in — getdata is issued only for CLSIG/
    // ISDLOCK (SyncService.onPeerInvForLocks) — so the cost is just inv traffic.
    this.pool = new Pool({
      network,
      maxSize: POOL_MAX_SIZE,
      relay: true,
      messages: this.messages,
      dnsSeed: true,
    } as never)

    this.bindForwarders()
  }

  start = (): void => {
    this.pool.connect()
    this.refillTimer = setInterval(() => {
      if (this.stopped) return
      if (this.readyPeers.size < HEADER_RACE_PEERS) {
        const before = this.pool.numberConnected()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(this.pool as any)._fillConnections()
        const after = this.pool.numberConnected()
        if (after > before) {
          console.log(`[pool] refill connected=${before}->${after} ready=${this.readyPeers.size}`)
        }
      }
    }, POOL_REFILL_INTERVAL_MS)
    this.refillTimer.unref?.()
  }

  stop = (): void => {
    if (this.stopped) return
    this.stopped = true
    if (this.refillTimer) {
      clearInterval(this.refillTimer)
      this.refillTimer = null
    }
    try { this.pool.disconnect() } catch { /* ignore */ }
    this.readyPeers.clear()
    this.filterCapablePeers.clear()
  }

  private bindForwarders(): void {
    // Track ready/+CF state ourselves so workers don't have to duplicate
    // the bookkeeping. They just read this.readyPeers / filterCapablePeers.
    this.pool.on('peerversion', (peer: Peer, message: Message & { services?: bigint }) => {
      const services = message.services ?? 0n
      this.peerServices.set(peer, services)
      if ((services & BigInt(NODE_COMPACT_FILTERS)) !== 0n) {
        this.filterCapablePeers.add(peer)
      }
    })
    this.pool.on('peerready', (peer: Peer) => {
      this.readyPeers.add(peer)
    })
    this.pool.on('peerdisconnect', (peer: Peer) => {
      this.readyPeers.delete(peer)
      this.filterCapablePeers.delete(peer)
    })

    // Re-emit every event the Pool emits so workers can subscribe.
    for (const evt of FORWARDED_EVENTS) {
      this.pool.on(evt as string, (...args: unknown[]) => {
        super.emit(evt as string, ...args)
      })
    }
  }

  // Typed wrappers — fall back to EventEmitter under the hood.
  override on<K extends keyof PoolServiceEventMap>(event: K, listener: PoolServiceEventMap[K]): this {
    return super.on(event, listener as (...args: unknown[]) => void)
  }
  override off<K extends keyof PoolServiceEventMap>(event: K, listener: PoolServiceEventMap[K]): this {
    return super.off(event, listener as (...args: unknown[]) => void)
  }
}