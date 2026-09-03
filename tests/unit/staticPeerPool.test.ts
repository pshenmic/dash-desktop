import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

const captured = vi.hoisted(() => ({options: [] as Array<Record<string, unknown>>}))

vi.mock('dash-core-p2p', async () => {
  const {EventEmitter} = await import('events')
  const networks: Record<string, {name: string; port: number; dnsSeeds: string[]}> = {
    mainnet: {name: 'mainnet', port: 9999, dnsSeeds: ['seed.example']},
    testnet: {name: 'testnet', port: 19999, dnsSeeds: ['seed.example']},
  }
  return {
    Messages: class {
      GetAddr = (): {command: string} => ({command: 'getaddr'})
      Ping = (): {command: string; nonce: Uint8Array} => ({command: 'ping', nonce: new Uint8Array(8)})
    },
    Networks: {get: (network: string) => networks[network]},
    NODE_COMPACT_FILTERS: 64,
    Pool: class extends EventEmitter {
      _addrs: Array<{ip: {v4?: string; v6?: string}; port: number}> = []
      _connectedPeers = {}
      network: {port: number; dnsSeeds: string[]}
      dnsSeed: boolean
      maxSize = 0
      fills = 0
      constructor(options: {network: string | {port: number; dnsSeeds: string[]}; maxSize: number; dnsSeed?: boolean}) {
        super()
        captured.options.push(options as unknown as Record<string, unknown>)
        this.network = typeof options.network === 'string' ? networks[options.network]! : options.network
        this.maxSize = options.maxSize
        this.dnsSeed = options.dnsSeed !== false
      }
      connect = (): void => undefined
      disconnect = (): void => undefined
      numberConnected = (): number => 0
      _addAddr = (addr: {ip: {v4?: string}; port: number}): void => { this._addrs.push(addr) }
      _fillConnections = (): void => { this.fills++ }
    },
  }
})

import {PoolService} from '../../src/main/p2p/net/PoolService'
import {POOL_FILL_STALL_LIMIT, POOL_REFILL_INTERVAL_MS} from '../../src/main/p2p/constants'

const PEERS = ['1.2.3.4', '5.6.7.8:19999']

type RawPool = {fills: number; _addrs: Array<{ip: {v4?: string; v6?: string}; port: number}>}
const raw = (service: PoolService): RawPool => service.pool as unknown as RawPool
const dialled = (service: PoolService): string[] =>
  raw(service)._addrs.map(a => `${a.ip.v4 ?? a.ip.v6}:${a.port}`)

const pinned = (): PoolService => new PoolService('testnet', {
  staticPeers: true,
  peers: PEERS,
  readyPeers: PEERS.length,
  minPeers: PEERS.length,
  maxConnections: PEERS.length,
})

describe('a pinned peer pool', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    captured.options.length = 0
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('dials the named peers and nothing else', () => {
    const service = pinned()
    service.start()

    expect(dialled(service)).toEqual(['1.2.3.4:19999', '5.6.7.8:19999'])
    service.stop()
  })

  // Two separate doors into the address book: DNS on start, and dash-core-p2p's
  // own `addr` handler for the rest of the session.
  it('runs no DNS seed and records no gossiped address', () => {
    const service = pinned()

    expect(captured.options[0]!.dnsSeed).toBe(false)
    expect(captured.options[0]!.listenAddr).toBe(false)
    service.stop()
  })

  it('asks a seated peer for no addresses', () => {
    const service = pinned()
    service.start()
    const sent: Array<{command: string}> = []
    const peer = {
      host: '1.2.3.4', port: 19999, version: 70000, bestHeight: 1,
      sendMessage: (message: {command: string}) => { sent.push(message) },
    }
    service.pool.emit('peerready', peer as never)

    expect(sent).toEqual([])
    service.stop()
  })

  // The stall limit and the built-in fallback both answer "gossip gave us
  // nothing usable". Neither applies to a set the user named by hand.
  it('keeps retrying past the stall limit without reaching for a fallback peer', () => {
    const service = pinned()
    service.start()
    const fillsAtStart = raw(service).fills

    vi.advanceTimersByTime(POOL_REFILL_INTERVAL_MS * (POOL_FILL_STALL_LIMIT + 5))

    expect(raw(service).fills - fillsAtStart).toBe(POOL_FILL_STALL_LIMIT + 5)
    expect(dialled(service)).toEqual(['1.2.3.4:19999', '5.6.7.8:19999'])
    service.stop()
  })

  it('hands none of its addresses to another pool', () => {
    const service = pinned()
    service.start()

    expect(service.takeAddresses(0)).toEqual([])
    expect(dialled(service)).toHaveLength(2)
    service.stop()
  })
})
