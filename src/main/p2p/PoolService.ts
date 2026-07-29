import {EventEmitter} from 'events'
import {AddrInfo, Message, Messages, NODE_COMPACT_FILTERS, Peer, Pool} from 'dash-core-p2p'
import {Network} from '../src/types'
import {POOL_FILL_STALL_LIMIT, POOL_MAX_CONNECTIONS, POOL_MIN_PEERS, POOL_READY_PEERS, POOL_REFILL_INTERVAL_MS} from './constants'

// Shared peer pool for all workers in the utility process. Tracks ready
// peers and the +CF subset; re-emits the dash-core-p2p Pool events through
// a typed EventEmitter so multiple workers can subscribe independently.
//
// Workers MUST NOT instantiate their own Pool — having parallel pools
// fights for the same peer addresses, doubles socket usage, and makes
// peer-state coordination (which peers serve filters, who's the leader)
// impossible. One pool, many subscribers.

export interface PoolServiceOptions {
  // false drops the tx inv stream — and with it ISLOCK/ISDLOCK inv, so only a
  // pool that never needs lock detection may set it.
  relay?: boolean
  dnsSeed?: boolean
  readyPeers?: number
  minPeers?: number
  maxConnections?: number
}

export interface PoolServiceEventMap {
  peerconnect: (peer: Peer) => void
  peerready: (peer: Peer) => void
  peerdisconnect: (peer: Peer) => void
  peerversion: (peer: Peer, message: Message & { services?: bigint }) => void
  peerheaders: (peer: Peer, message: Message & { headers?: Uint8Array[] }) => void
  peerinv: (peer: Peer, message: Message & { inventory?: Array<{ type: number; hash: Uint8Array }> }) => void
  peeraddr: (peer: Peer, message: Message & { addresses?: unknown[] }) => void
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
  'peerheaders', 'peerinv', 'peerblock', 'peeraddr',
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

  // Addresses dash-core-p2p knows but has not connected to. The bulk pool will
  // draw from here so the two pools stay disjoint.
  get knownAddresses(): AddrInfo[] {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pool = this.pool as any
    return (pool._addrs as AddrInfo[]).filter(addr => !(addr.hash! in pool._connectedPeers))
  }

  private readonly readyTarget: number
  private readonly minPeers: number
  private readonly maxConnections: number
  private lastReady = -1
  private stalledFills = 0
  private refillTimer: ReturnType<typeof setInterval> | null = null
  private stopped = false

  constructor(network: Network, options: PoolServiceOptions = {}) {
    super()
    this.network = network
    this.messages = new Messages({network} as never)
    this.readyTarget = options.readyPeers ?? POOL_READY_PEERS
    this.minPeers = options.minPeers ?? POOL_MIN_PEERS
    this.maxConnections = options.maxConnections ?? POOL_MAX_CONNECTIONS
    this.pool = new Pool({
      network,
      maxSize: this.readyTarget,
      relay: options.relay ?? true,
      messages: this.messages,
      dnsSeed: options.dnsSeed ?? true,
    } as never)

    this.bindForwarders()
  }

  start = (): void => {
    this.pool.connect()
    this.refillTimer = setInterval(() => {
      if (this.stopped) return
      // maxSize caps *connections*, and most addresses from `addr` gossip are
      // dead — their half-open sockets hold slots until they time out. So open
      // capacity wide while short of peers and clamp it back once we have
      // enough, otherwise dead sockets crowd out live ones and the pool never
      // fills. Clamping to the live count also stops the pool dialling out
      // again the moment a slot frees.
      const ready = this.readyPeers.size
      // Any movement means the book still has something to give; a run of
      // ticks with none means we have found the network's ceiling, and
      // widening further just re-dials the same dead addresses.
      if (ready !== this.lastReady) this.stalledFills = 0
      this.lastReady = ready

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pool = this.pool as any
      if (ready < this.minPeers && this.stalledFills < POOL_FILL_STALL_LIMIT) {
        this.stalledFills++
        pool.maxSize = this.maxConnections
        const before = this.pool.numberConnected()
        pool._fillConnections()
        const after = this.pool.numberConnected()
        if (after > before) {
          console.log(`[pool] refill connected=${before}->${after} ready=${ready} known=${pool._addrs.length}`)
        }
        return
      }

      // Wide capacity leaves a backlog of sockets still shaking hands, so
      // closing the tap is not enough — the surplus has to be dropped, newest
      // first to keep the longest-lived connections.
      pool.maxSize = this.readyTarget
      if (ready > this.readyTarget) {
        const surplus = [...this.readyPeers].slice(this.readyTarget)
        for (const peer of surplus) {
          this.readyPeers.delete(peer)
          try { peer.disconnect() } catch { /* already gone */ }
        }
        console.log(`[pool] trimmed ${surplus.length} peers ready=${ready}->${this.readyPeers.size}`)
      }
    }, POOL_REFILL_INTERVAL_MS)
    this.refillTimer.unref?.()
  }

  // Take addresses discovered by another pool. Lets the bulk pool skip DNS and
  // its own gossip entirely, drawing only on addresses the lock pool found and
  // is not itself using, so the two pools stay disjoint.
  addAddresses = (addrs: AddrInfo[]): void => {
    if (addrs.length === 0 || this.stopped) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pool = this.pool as any
    for (const addr of addrs) pool._addAddr({...addr, hash: undefined, retryTime: undefined})
    pool._fillConnections()
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
      // request peer addresses
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      peer.sendMessage((this.messages as any).GetAddr())
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
