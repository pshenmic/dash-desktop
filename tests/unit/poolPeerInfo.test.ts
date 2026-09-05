import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

vi.mock('dash-core-p2p', async () => {
  const {EventEmitter} = await import('events')
  let counter = 0
  return {
    Messages: class {
      GetAddr = (): {command: string} => ({command: 'getaddr'})
      Ping = (): {command: string; nonce: Uint8Array} =>
        ({command: 'ping', nonce: Uint8Array.from([0, 0, 0, 0, 0, 0, 0, ++counter])})
    },
    Networks: {get: (network: string) => ({name: network, port: 19999, dnsSeeds: ['seed.example']})},
    NODE_COMPACT_FILTERS: 64,
    Pool: class extends EventEmitter {
      _addrs: Array<{ip: {v4?: string; v6?: string}; port: number}> = []
      _connectedPeers: Record<string, unknown> = {}
      network = {port: 19999, dnsSeeds: ['seed.example']}
      dnsSeed = true
      maxSize = 0
      constructor(options: {maxSize: number}) {
        super()
        this.maxSize = options.maxSize
      }
      connect = (): void => undefined
      disconnect = (): void => undefined
      numberConnected = (): number => 0
      _addAddr = (addr: {ip: {v4?: string; v6?: string}; port: number}): void => { this._addrs.push(addr) }
      _fillConnections = (): void => undefined
    },
  }
})

import {PoolService} from '../../src/main/p2p/net/PoolService'
import {POOL_PING_FIRST_MS, POOL_PING_INTERVAL_MS, POOL_REFILL_INTERVAL_MS} from '../../src/main/p2p/constants'
import {PeerRegistry} from '../../src/main/p2p/net/peerRegistry'

const PING_TICKS = Math.ceil(POOL_PING_INTERVAL_MS / POOL_REFILL_INTERVAL_MS) + 1

interface FakePeer {
  host: string
  port: number
  subversion: string | null
  sent: Array<{command: string; nonce?: Uint8Array}>
  sendMessage: (message: {command: string; nonce?: Uint8Array}) => void
  disconnect: () => void
  disconnects: number
}

const fakePeer = (host: string, subversion: string | null = '/Dash Core:22.1.0/'): FakePeer => {
  const peer: FakePeer = {
    host, port: 19999, subversion, sent: [], disconnects: 0,
    disconnect: () => { peer.disconnects++ },
    sendMessage: message => { peer.sent.push(message) },
  }
  return peer
}

// Clock the refill interval runs off, so a test that advanced by a round trip
// can put itself back on the grid before waiting for the next ping.
let tickOrigin = 0

type RawPool = {
  _connectedPeers: Record<string, unknown>
  _addrs: Array<{ip: {v4?: string; v6?: string}; port: number}>
  emit: (event: string, ...args: unknown[]) => boolean
}
const raw = (service: PoolService): RawPool => service.pool as unknown as RawPool

let seatKey = 0
let registry: PeerRegistry
// The real lifecycle: a socket connects, and only a socket that survives that
// goes on to complete a handshake. Keyed per call, as the pool keys by the
// address hash — two entries for one host is the case under test, not a
// collision.
const seat = (service: PoolService, peer: FakePeer): void => {
  raw(service)._connectedPeers[`seat${seatKey++}`] = peer
  raw(service).emit('peerconnect', peer)
  if (peer.disconnects === 0) raw(service).emit('peerready', peer)
}

// Pings ride the refill tick, so the wait is in ticks rather than a single jump
// — and a peer that is never pinged fails here rather than further down.
const nextPing = (peer: FakePeer): {command: string; nonce?: Uint8Array} => {
  // Past the one-shot first ping, which rides its own timer rather than a tick.
  vi.advanceTimersByTime(POOL_PING_FIRST_MS)
  const offset = (Date.now() - tickOrigin) % POOL_REFILL_INTERVAL_MS
  if (offset > 0) vi.advanceTimersByTime(POOL_REFILL_INTERVAL_MS - offset)
  for (let tick = 0; tick < PING_TICKS; tick++) {
    peer.sent.length = 0
    vi.advanceTimersByTime(POOL_REFILL_INTERVAL_MS)
    const ping = peer.sent.find(m => m.command === 'ping')
    if (ping) return ping
  }
  throw new Error('pool sent no ping')
}

describe('peer info reported off a pool', () => {
  let service: PoolService

  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    seatKey = 0
    registry = new PeerRegistry()
    service = new PoolService('testnet', {label: 'lock-pool', registry})
    service.start()
    tickOrigin = Date.now()
  })

  afterEach(() => {
    service.stop()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('reports host, user agent and pool for every seated peer', () => {
    seat(service, fakePeer('1.1.1.1'))
    seat(service, fakePeer('2.2.2.2', null))

    expect(service.peerInfo()).toEqual([
      {pool: 'lock-pool', host: '1.1.1.1', port: 19999, userAgent: '/Dash Core:22.1.0/', pingMs: null},
      {pool: 'lock-pool', host: '2.2.2.2', port: 19999, userAgent: null, pingMs: null},
    ])
  })

  // Fast, but off the handshake: a round trip measured while version, verack and
  // addr are still crossing times that exchange and our own reader, not the link.
  it('measures a peer a moment after its handshake, not during it', () => {
    const peer = fakePeer('1.1.1.1')
    seat(service, peer)
    expect(peer.sent.map(m => m.command)).toEqual(['getaddr'])

    vi.advanceTimersByTime(POOL_PING_FIRST_MS)
    const ping = peer.sent.find(m => m.command === 'ping')
    expect(ping).toBeDefined()

    vi.advanceTimersByTime(178)
    raw(service).emit('peerpong', peer, {nonce: ping!.nonce})

    expect(service.peerInfo()[0]!.pingMs).toBe(178)
  })

  // The peer that seats a moment after the pool-wide interval used to be missed
  // by it entirely; nothing about a peer's first measurement waits on that clock.
  it('measures every peer on its own schedule', () => {
    const early = fakePeer('1.1.1.1')
    seat(service, early)
    vi.advanceTimersByTime(POOL_PING_FIRST_MS)
    const earlyPing = early.sent.find(m => m.command === 'ping')
    vi.advanceTimersByTime(24)
    raw(service).emit('peerpong', early, {nonce: earlyPing!.nonce})

    const late = fakePeer('2.2.2.2')
    seat(service, late)
    vi.advanceTimersByTime(POOL_PING_FIRST_MS)
    const latePing = late.sent.find(m => m.command === 'ping')
    vi.advanceTimersByTime(8)
    raw(service).emit('peerpong', late, {nonce: latePing!.nonce})

    expect(service.peerInfo().map(p => p.pingMs)).toEqual([24, 8])
  })

  it('drops a pending first ping when the pool stops', () => {
    const peer = fakePeer('1.1.1.1')
    seat(service, peer)
    service.stop()

    vi.advanceTimersByTime(POOL_PING_FIRST_MS * 2)

    expect(peer.sent.map(m => m.command)).toEqual(['getaddr'])
  })

  it('times the round trip from the pong that answers its own ping', () => {
    const peer = fakePeer('1.1.1.1')
    seat(service, peer)

    const ping = nextPing(peer)
    vi.advanceTimersByTime(40)
    raw(service).emit('peerpong', peer, {nonce: ping.nonce})

    expect(service.peerInfo()[0]!.pingMs).toBe(40)
  })

  // A pong is only ever an answer: nothing in the protocol says which ping it
  // answers but the nonce, and an unmatched one would time the wrong round trip.
  it('ignores a pong carrying a nonce it never sent', () => {
    const peer = fakePeer('1.1.1.1')
    seat(service, peer)

    nextPing(peer)
    vi.advanceTimersByTime(40)
    raw(service).emit('peerpong', peer, {nonce: Uint8Array.from([9, 9, 9, 9, 9, 9, 9, 9])})

    expect(service.peerInfo()[0]!.pingMs).toBeNull()
  })

  it('reports the round trip its last ping measured', () => {
    const peer = fakePeer('1.1.1.1')
    seat(service, peer)

    for (const rtt of [194, 21]) {
      const ping = nextPing(peer)
      vi.advanceTimersByTime(rtt)
      raw(service).emit('peerpong', peer, {nonce: ping.nonce})
      expect(service.peerInfo()[0]!.pingMs).toBe(rtt)
    }
  })

  // What the endpoint showed on testnet: one node holding fifteen of the bulk
  // pool's slots, every entry hashing differently and dialling the same host.
  // Dropped as the socket opens — a duplicate that lives even seconds is long
  // enough for Core to hang up on both.
  it('keeps one socket per dial target and drops the rest as they connect', () => {
    const peers = [fakePeer('68.67.122.38'), fakePeer('68.67.122.38'), fakePeer('68.67.122.38')]
    for (const peer of peers) seat(service, peer)

    expect(service.peerInfo().map(p => p.host)).toEqual(['68.67.122.38'])
    expect(peers.map(p => p.disconnects)).toEqual([0, 1, 1])
  })

  // 0.0.0.0 reaches the node running on this machine, and answers in 2ms. It is
  // a peer like any other — duplication was never a property of the address.
  it('keeps a peer on any address that answers, 0.0.0.0 included', () => {
    seat(service, fakePeer('0.0.0.0'))
    seat(service, fakePeer('198.18.0.115'))
    raw(service)._addrs = [
      {ip: {v6: '0000:0000:0000:0000:0000:0000:0000:0000', v4: '0.0.0.0'}, port: 19999},
      {ip: {v4: '198.18.0.115'}, port: 19999},
    ]

    vi.advanceTimersByTime(POOL_REFILL_INTERVAL_MS)

    expect(service.peerInfo().map(p => p.host)).toEqual(['0.0.0.0', '198.18.0.115'])
    expect(raw(service)._addrs).toHaveLength(2)
  })

  // The measured case: 89.169.164.19 and three masternodes connected on both
  // pools at once, which is what makes Core drop both sockets.
  it('leaves a node to whichever pool reached it first', () => {
    const other = new PoolService('testnet', {label: 'bulk-pool', registry})
    other.start()
    seat(service, fakePeer('89.169.164.19'))
    const rejected = fakePeer('89.169.164.19')
    seat(other, rejected)
    seat(other, fakePeer('68.67.122.38'))
    ;(other.pool as unknown as RawPool)._addrs = [{ip: {v4: '89.169.164.19'}, port: 19999}]

    expect(service.peerInfo().map(p => p.host)).toEqual(['89.169.164.19'])
    expect(other.peerInfo().map(p => p.host)).toEqual(['68.67.122.38'])
    expect(rejected.disconnects).toBe(1)

    // Nor may it keep re-dialling what the other pool holds.
    vi.advanceTimersByTime(POOL_REFILL_INTERVAL_MS)
    expect((other.pool as unknown as RawPool)._addrs).toEqual([])
    other.stop()
  })

  // Nothing announces a dropped peer to the other pool, so the claim has to be
  // released with the socket or the node is unreachable for the rest of the
  // session.
  it('frees a node the moment the pool holding it loses the socket', () => {
    const other = new PoolService('testnet', {label: 'bulk-pool', registry})
    other.start()
    const peer = fakePeer('89.169.164.19')
    seat(service, peer)

    service.readyPeers.delete(peer as never)
    for (const key of Object.keys(raw(service)._connectedPeers)) delete raw(service)._connectedPeers[key]
    raw(service).emit('peerdisconnect', peer)
    seat(other, fakePeer('89.169.164.19'))

    expect(other.peerInfo().map(p => p.host)).toEqual(['89.169.164.19'])
    other.stop()
  })

  it('reports nothing for a pool with no seated peer', () => {
    vi.advanceTimersByTime(POOL_REFILL_INTERVAL_MS * 4)

    expect(service.peerInfo()).toEqual([])
  })
})
