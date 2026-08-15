import {EventEmitter} from 'events'
import {AddrInfo, Message, Messages, Networks, NODE_COMPACT_FILTERS, Peer, Pool} from 'dash-core-p2p'
import {Network} from '../src/types/Network'
import {parsePeerAddress} from './peerAddress'
import {FALLBACK_PEERS, POOL_ADDRESS_RESERVE, POOL_CONNECT_HEADROOM, POOL_FALLBACK_TICKS, POOL_FILL_STALL_LIMIT, POOL_MAX_CONNECTIONS, POOL_MIN_PEERS, POOL_READY_PEERS, POOL_REFILL_INTERVAL_MS, POOL_SHORT_REPORT_TICKS} from './constants'

// One pool, many subscribers. Workers must not instantiate their own Pool —
// parallel pools fight for the same peer addresses and make peer-state
// coordination (who serves filters, who leads a race) impossible.

import {PoolServiceEventMap, PoolServiceOptions} from './types/pool'
import {FORWARDED_EVENTS} from './constants'

export class PoolService extends EventEmitter {
  readonly network: Network
  readonly messages: Messages
  readonly pool: Pool
  readonly readyPeers = new Set<Peer>()
  readonly filterCapablePeers = new Set<Peer>()
  readonly peerServices = new WeakMap<Peer, bigint>()

  // Moves rather than copies: Dash Core caps connections per source IP, so two
  // pools dialling the same nodes means one starves.
  //
  // Only the surplus above the reserve moves. Handing over a *fraction* of the
  // book drained it instead: this runs on every gossip and every peer change,
  // so half of the remainder went each time — measured at 33 known addresses
  // and 2 ready peers here against 731 and 18 in the pool being fed.
  takeAddresses(): AddrInfo[] {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pool = this.pool as any
    const addrs = pool._addrs as AddrInfo[]
    const spare = addrs.filter(addr =>
      !(addr.hash! in pool._connectedPeers) && addr.retryTime == null)

    const taken = spare.slice(0, Math.max(0, spare.length - POOL_ADDRESS_RESERVE))
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
  private fallbackDialled = false
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

    // Networks.get hands a network object straight back, so a copy carrying
    // different seeds is all it takes to redirect discovery.
    const seeds = options.dnsSeeds ?? []
    const base = Networks.get(network)
    this.pool = new Pool({
      network: seeds.length > 0 && base ? {...base, dnsSeeds: seeds} : network,
      maxSize: this.readyTarget,
      relay: options.relay ?? true,
      messages: this.messages,
      dnsSeed: options.dnsSeed ?? true,
    } as never)

    this.bindForwarders()
  }

  start = (): void => {
    this.pool.connect()
    const seeds = this.pool.dnsSeed ? this.pool.network?.dnsSeeds ?? [] : []
    console.log(`[${this.label}] start seeds=${seeds.join(',') || '(none)'} custom=${this.customPeers.length} known=${this.pool._addrs.length}`)
    this.addAddresses(this.parsePeers(this.customPeers))
    this.refillTimer = setInterval(() => {
      if (this.stopped) return
      // maxSize caps connections, not ready peers, and dead gossip addresses
      // hold half-open slots until they time out — so capacity opens wide while
      // short and clamps back once filled, or dead sockets crowd out live ones.
      const ready = this.readyPeers.size
      // A run of ticks with no movement means we have found the network's
      // ceiling; widening past it just re-dials the same dead addresses.
      if (ready !== this.lastReady) this.stalledFills = 0
      this.lastReady = ready

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pool = this.pool as any

      // Nothing connected is a different failure from being under target: it
      // means discovery produced no usable address, which no amount of
      // refilling fixes.
      if (ready > 0) this.emptyTicks = 0
      else if (++this.emptyTicks >= POOL_FALLBACK_TICKS) this.dialFallbackPeers()

      if (ready < this.minPeers && ++this.shortTicks >= POOL_SHORT_REPORT_TICKS) {
        this.shortTicks = 0
        console.log(`[${this.label}] short ready=${ready}/${this.minPeers} connected=${this.pool.numberConnected()} known=${this.pool._addrs.length} stalled=${this.stalledFills}/${POOL_FILL_STALL_LIMIT}`)
      }

      if (ready < this.minPeers && this.stalledFills < POOL_FILL_STALL_LIMIT) {
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
          try { peer.disconnect() } catch { /* already gone */ }
        }
        console.log(`[${this.label}] trimmed ${surplus.length} peers ready=${ready}->${this.readyPeers.size}`)
      }
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

    // Tracked here so workers just read readyPeers / filterCapablePeers.
    this.pool.on('peerversion', (peer: Peer, message: Message & { services?: bigint }) => {
      const services = message.services ?? 0n
      this.peerServices.set(peer, services)
      if ((services & BigInt(NODE_COMPACT_FILTERS)) !== 0n) {
        this.filterCapablePeers.add(peer)
      }
    })
    this.pool.on('peerready', (peer: Peer) => {
      this.readyPeers.add(peer)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      peer.sendMessage((this.messages as any).GetAddr())
    })
    this.pool.on('peerdisconnect', (peer: Peer) => {
      this.readyPeers.delete(peer)
      this.filterCapablePeers.delete(peer)
    })

    for (const evt of FORWARDED_EVENTS) {
      this.pool.on(evt as string, (...args: unknown[]) => {
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
