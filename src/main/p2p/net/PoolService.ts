import {EventEmitter} from 'events'
import {AddrInfo, Message, Messages, Networks, NODE_COMPACT_FILTERS, Peer, Pool} from 'dash-core-p2p'
import {Network} from '../../src/types/Network'
import {parsePeerAddress} from './peerAddress'
import {FALLBACK_PEERS, PEER_KEEPALIVE_DELAY_MS, POOL_ADDRESS_RESERVE, POOL_CONNECT_HEADROOM, POOL_DIAL_REPORT_TICKS, POOL_FALLBACK_TICKS, POOL_FILL_STALL_LIMIT, POOL_MAX_CONNECTIONS, POOL_MIN_PEERS, POOL_READY_PEERS, POOL_REFILL_INTERVAL_MS, POOL_SHORT_REPORT_TICKS, POOL_SILENCE_PROBE_MS, POOL_SILENCE_TIMEOUT_MS} from '../constants'

// One pool, many subscribers. Workers must not instantiate their own Pool —
// parallel pools fight for the same peer addresses and make peer-state
// coordination (who serves filters, who leads a race) impossible.

import {PoolServiceEventMap, PoolServiceOptions} from '../types/pool'
import {DIAL_LIFECYCLE_EVENTS, FORWARDED_EVENTS} from '../constants'

export class PoolService extends EventEmitter {
  readonly network: Network
  readonly messages: Messages
  readonly pool: Pool
  readonly readyPeers = new Set<Peer>()
  // Read by BroadcastService: a pinned pool is usually too small to hold a
  // propagation witness back.
  readonly staticPeers: boolean
  readonly filterCapablePeers = new Set<Peer>()
  readonly peerServices = new WeakMap<Peer, bigint>()

  // Moves rather than copies: a node dialled twice from one host drops both
  // connections, so every address has exactly one owner. Only the surplus above
  // the reserve moves — this runs on every gossip and every peer change, so a
  // fractional hand-off would drain the book a slice at a time.
  takeAddresses(reserve = POOL_ADDRESS_RESERVE): AddrInfo[] {
    // A pinned pool holds only the addresses the user named, and handing one
    // away would leave it unable to redial that peer.
    if (this.staticPeers) return []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pool = this.pool as any
    const addrs = pool._addrs as AddrInfo[]
    const spare = addrs.filter(addr =>
      !(addr.hash! in pool._connectedPeers) && addr.retryTime == null)

    const taken = spare.slice(0, Math.max(0, spare.length - reserve))
    if (taken.length === 0) return []

    const gone = new Set(taken.map(addr => addr.hash))
    pool._addrs = addrs.filter((addr: AddrInfo) => !gone.has(addr.hash))
    return taken
  }

  private readonly label: string
  private readonly customPeers: string[]
  private readonly readyTarget: number
  private readonly minPeers: number
  private readonly maxConnections: number
  private lastReady = -1
  private stalledFills = 0
  private shortTicks = 0
  private emptyTicks = 0
  private dialTicks = 0
  private failedDials = 0
  private seatedDials = 0
  private fallbackDialled = false
  private noDelayPeers = 0
  private noDelayUnavailable = false
  private lastMessageAt = Date.now()
  private silenceProbedAt: number | null = null
  private refillTimer: ReturnType<typeof setInterval> | null = null
  private stopped = false

  constructor(network: Network, options: PoolServiceOptions = {}) {
    super()
    this.network = network
    this.messages = new Messages({network} as never)
    this.label = options.label ?? 'pool'
    this.readyTarget = options.readyPeers ?? POOL_READY_PEERS
    this.minPeers = options.minPeers ?? POOL_MIN_PEERS
    this.maxConnections = options.maxConnections ?? POOL_MAX_CONNECTIONS
    this.customPeers = options.peers ?? []
    this.staticPeers = options.staticPeers ?? false

    // Networks.get hands a network object straight back, so a copy carrying
    // different seeds is all it takes to redirect discovery.
    const seeds = this.staticPeers ? [] : options.dnsSeeds ?? []
    const base = Networks.get(network)
    this.pool = new Pool({
      network: seeds.length > 0 && base ? {...base, dnsSeeds: seeds} : network,
      // Opened at the ready target, not at maxConnections: most gossiped
      // addresses are dead, and their socket setup and teardown runs on the same
      // thread that parses sync responses. The refill loop widens when short.
      maxSize: this.readyTarget,
      relay: options.relay ?? true,
      messages: this.messages,
      dnsSeed: this.staticPeers ? false : options.dnsSeed ?? true,
      // dash-core-p2p's own `addr` handler is what records gossiped addresses,
      // so switching it off is what keeps a pinned pool pinned — dropping the
      // getaddr below is not enough, peers gossip unprompted.
      listenAddr: !this.staticPeers,
    } as never)

    this.bindForwarders()
  }

  start = (): void => {
    this.pool.connect()
    const seeds = this.pool.dnsSeed ? this.pool.network?.dnsSeeds ?? [] : []
    console.log(`[${this.label}] start seeds=${seeds.join(',') || '(none)'} custom=${this.customPeers.length} known=${this.pool._addrs.length}`)
    this.addAddresses(this.parsePeers(this.customPeers))

    // Capacity opens at the ready target and only widens on a refill tick a full
    // interval later, by which time dead gossip addresses hold every slot and no
    // further dial is possible. The tick clamps it back.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const initialFill = this.pool as any
    initialFill.maxSize = this.maxConnections
    initialFill._fillConnections()

    this.refillTimer = setInterval(() => {
      if (this.stopped) return
      // maxSize caps connections, not ready peers, and dead gossip addresses hold
      // half-open slots until they time out — so capacity has to clamp back once
      // filled, or those sockets crowd out live ones.
      const ready = this.readyPeers.size
      // A run of ticks with no movement means we have found the network's
      // ceiling; widening past it just re-dials the same dead addresses.
      if (ready !== this.lastReady) this.stalledFills = 0
      this.lastReady = ready

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pool = this.pool as any

      if (++this.dialTicks >= POOL_DIAL_REPORT_TICKS) {
        this.dialTicks = 0
        console.log(
          `[${this.label}] dials: ${this.seatedDials} seated, ${this.failedDials} never handshook ` +
          `(ready=${ready} connected=${this.pool.numberConnected()} known=${pool._addrs.length})`,
        )
        this.failedDials = 0
        this.seatedDials = 0
      }

      // Ahead of the branches below because they all read `ready`, and after the
      // link drops every one of those peers is a socket that will never speak or
      // close again — a pool that looks full and is entirely dead.
      if (Date.now() - this.lastMessageAt <= POOL_SILENCE_TIMEOUT_MS) {
        this.silenceProbedAt = null
      } else if (ready > 0) {
        this.probeOrDropStalePeers(ready)
        return
      }

      // Nothing connected is a different failure from being under target: it
      // means discovery produced no usable address, which no amount of
      // refilling fixes.
      if (ready > 0) this.emptyTicks = 0
      else if (!this.staticPeers && ++this.emptyTicks >= POOL_FALLBACK_TICKS) this.dialFallbackPeers()

      if (ready < this.minPeers && ++this.shortTicks >= POOL_SHORT_REPORT_TICKS) {
        this.shortTicks = 0
        console.log(`[${this.label}] short ready=${ready}/${this.minPeers} connected=${this.pool.numberConnected()} known=${this.pool._addrs.length} stalled=${this.stalledFills}/${POOL_FILL_STALL_LIMIT}`)
      }

      // The stall limit exists to stop re-dialling dead gossip; a pinned pool has
      // no other address to reach for, so it keeps retrying the ones it was given.
      if (ready < this.minPeers && (this.staticPeers || this.stalledFills < POOL_FILL_STALL_LIMIT)) {
        this.stalledFills++
        pool.maxSize = this.maxConnections
        const before = this.pool.numberConnected()
        pool._fillConnections()
        const after = this.pool.numberConnected()
        if (after > before) {
          console.log(`[${this.label}] refill connected=${before}->${after} ready=${ready} known=${pool._addrs.length}`)
        }
        return
      }

      // Wide capacity leaves a backlog still shaking hands, so closing the tap
      // is not enough — the surplus is dropped newest-first to keep the
      // longest-lived connections.
      pool.maxSize = this.readyTarget + POOL_CONNECT_HEADROOM
      if (ready > this.readyTarget) {
        const surplus = [...this.readyPeers].slice(this.readyTarget)
        for (const peer of surplus) {
          this.readyPeers.delete(peer)
          // Both sets, not just readyPeers: peerdisconnect is what normally
          // clears this one, and a socket already gone never fires it — leaving
          // a dead peer that cf* requests are still routed to.
          this.filterCapablePeers.delete(peer)
          try { peer.disconnect() } catch { /* already gone */ }
        }
        console.log(`[${this.label}] trimmed ${surplus.length} peers ready=${ready}->${this.readyPeers.size}`)
      }
      // Deliberately no refill between the minimum and the target: most known
      // addresses are dead, so topping up a merely-below-target pool re-dials
      // them every tick and costs the sync more than the peers it seats.
    }, POOL_REFILL_INTERVAL_MS)
    this.refillTimer.unref?.()
  }

  // Receiving end of takeAddresses — lets the bulk pool skip DNS entirely and
  // live off what the lock pool found.
  addAddresses = (addrs: AddrInfo[]): void => {
    if (addrs.length === 0 || this.stopped) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pool = this.pool as any
    for (const addr of addrs) pool._addAddr({...addr, hash: undefined})
    console.log(`[${this.label}] +${addrs.length} peers(es) known=${this.pool._addrs.length}`)
    pool._fillConnections()
  }

  // Silence is not evidence on its own. The measured case: one static peer on a
  // quiet testnet says nothing for 90s, gets dropped as dead, and hands back a
  // full handshake seconds later — every 90s, forever. So the pool asks first,
  // and only a peer that will not answer is dropped.
  private probeOrDropStalePeers(ready: number): void {
    if (this.silenceProbedAt == null) {
      this.silenceProbedAt = Date.now()
      const quietFor = Math.round((Date.now() - this.lastMessageAt) / 1000)
      console.log(`[${this.label}] nothing heard from ${ready} peer(s) for ${quietFor}s — pinging`)
      for (const peer of this.readyPeers) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        try { peer.sendMessage((this.messages as any).Ping()) } catch { /* socket already gone */ }
      }
      return
    }
    if (Date.now() - this.silenceProbedAt < POOL_SILENCE_PROBE_MS) return
    this.dropStalePeers(ready)
  }

  // peer.disconnect() emits 'disconnect' synchronously, so the pool's own
  // bookkeeping (deprioritise, remove, refill) runs for each one.
  private dropStalePeers(ready: number): void {
    const quietFor = Math.round((Date.now() - this.lastMessageAt) / 1000)
    console.warn(`[${this.label}] ${ready} peer(s) left a ping unanswered after ${quietFor}s of silence — dropping them and redialling`)
    this.silenceProbedAt = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pool = this.pool as any
    for (const peer of Object.values(pool._connectedPeers) as Array<{disconnect: () => void}>) {
      try { peer.disconnect() } catch { /* already gone */ }
    }
    this.readyPeers.clear()
    this.filterCapablePeers.clear()
    this.lastMessageAt = Date.now()
    this.stalledFills = 0
    pool.maxSize = this.maxConnections
    pool._fillConnections()
  }

  private dialFallbackPeers(): void {
    if (this.fallbackDialled) return
    this.fallbackDialled = true

    const parsed = this.parsePeers(FALLBACK_PEERS[this.network])
    console.log(`[${this.label}] no peers after ${(POOL_FALLBACK_TICKS * POOL_REFILL_INTERVAL_MS) / 1000}s — dialling ${parsed.length} built-in address(es)`)
    this.addAddresses(parsed)
  }

  private parsePeers(entries: string[]): AddrInfo[] {
    const port = this.pool.network?.port ?? 0
    const parsed: AddrInfo[] = []
    for (const entry of entries) {
      const addr = parsePeerAddress(entry, port)
      if (addr == null) {
        console.error(`[${this.label}] ignoring unparseable peer ${JSON.stringify(entry)}`)
        continue
      }
      parsed.push(addr)
    }
    return parsed
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
    // Mainnet ships a single DNS seed and there is no peer cache behind it, so
    // a failed lookup leaves both pools with nothing to dial, permanently.
    this.pool.on('seed', (ips: string[]) => {
      console.log(`[${this.label}] dns seed returned ${ips.length} address(es)`)
    })
    this.pool.on('seederror', (err: Error) => {
      console.error(`[${this.label}] dns seed failed, no addresses to dial: ${err.message}`)
    })

    // dash-core-p2p never sets TCP_NODELAY. Every cf*/getheaders request is a
    // small write followed by a wait, which is the case Nagle plus the peer's
    // delayed ACK turns into a fixed ~40ms stall per round trip.
    this.pool.on('peerconnect', (peer: Peer) => {
      const socket = (peer as unknown as {
        socket?: {setNoDelay?: (on: boolean) => void; setKeepAlive?: (on: boolean, delay: number) => void}
      }).socket
      // Logged either way, once: whether this took effect is indistinguishable
      // from a slow network otherwise.
      if (typeof socket?.setNoDelay !== 'function') {
        if (!this.noDelayUnavailable) {
          this.noDelayUnavailable = true
          console.warn(`[${this.label}] socket has no setNoDelay — Nagle stays on`)
        }
        return
      }
      socket.setNoDelay(true)
      socket.setKeepAlive?.(true, PEER_KEEPALIVE_DELAY_MS)
      if (this.noDelayPeers++ === 0) {
        console.log(`[${this.label}] TCP_NODELAY and keepalive set on peer sockets`)
      }
    })

    // Tracked here so workers just read readyPeers / filterCapablePeers.
    this.pool.on('peerversion', (peer: Peer, message: Message & { services?: bigint }) => {
      this.peerServices.set(peer, message.services ?? 0n)
    })
    // filterCapablePeers is filled here rather than on `peerversion`, which
    // arrives mid-handshake: a request sent to a peer that has not finished one
    // is simply never answered, and costs a full race timeout to find out.
    // Peer lifecycle is logged here rather than in the workers: this is the only
    // place that knows whether a socket ever completed a handshake, and both
    // workers subscribing meant two lines per event saying the same thing.
    this.pool.on('peerready', (peer: Peer) => {
      this.readyPeers.add(peer)
      const cf = ((this.peerServices.get(peer) ?? 0n) & BigInt(NODE_COMPACT_FILTERS)) !== 0n
      if (cf) this.filterCapablePeers.add(peer)
      this.seatedDials++
      console.log(
        `[${this.label}] peerready ${peer.host}:${peer.port} v${peer.version} ` +
        `bestHeight=${peer.bestHeight} ${cf ? '+CF' : '-CF'} ready=${this.readyPeers.size}`,
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!this.staticPeers) peer.sendMessage((this.messages as any).GetAddr())
    })
    this.pool.on('peerdisconnect', (peer: Peer) => {
      const wasReady = this.readyPeers.delete(peer)
      this.filterCapablePeers.delete(peer)
      // A dead gossip address dropping is the expected case and the bulk of the
      // churn; only a peer we actually had is worth a line of its own.
      if (wasReady) {
        console.log(`[${this.label}] peerdisconnect ${peer.host}:${peer.port} ready=${this.readyPeers.size}`)
      } else {
        this.failedDials++
      }
    })

    for (const evt of FORWARDED_EVENTS) {
      const speaks = !DIAL_LIFECYCLE_EVENTS.has(evt)
      this.pool.on(evt as string, (...args: unknown[]) => {
        if (speaks) this.lastMessageAt = Date.now()
        super.emit(evt as string, ...args)
      })
    }
  }

  override on<K extends keyof PoolServiceEventMap>(event: K, listener: PoolServiceEventMap[K]): this {
    return super.on(event, listener as (...args: unknown[]) => void)
  }
  override off<K extends keyof PoolServiceEventMap>(event: K, listener: PoolServiceEventMap[K]): this {
    return super.off(event, listener as (...args: unknown[]) => void)
  }
}
