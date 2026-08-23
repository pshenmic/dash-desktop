import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

vi.mock('dash-core-p2p', async () => {
  const {EventEmitter} = await import('events')
  return {
    Messages: class { GetAddr = (): {command: string} => ({command: 'getaddr'}) },
    Networks: {get: (network: string) => ({name: network, port: network === 'mainnet' ? 9999 : 19999, dnsSeeds: ['seed.example']})},
    NODE_COMPACT_FILTERS: 64,
    Pool: class extends EventEmitter {
      _addrs: unknown[] = []
      _connectedPeers: Record<string, unknown> = {}
      network = {port: 19999, dnsSeeds: ['seed.example']}
      dnsSeed = true
      maxSize = 0
      fills = 0
      constructor(options: {maxSize: number}) {
        super()
        this.maxSize = options.maxSize
      }
      connect = (): void => undefined
      disconnect = (): void => undefined
      numberConnected = (): number => Object.keys(this._connectedPeers).length
      _addAddr = (addr: unknown): void => { this._addrs.push(addr) }
      _fillConnections = (): void => { this.fills++ }
    },
  }
})

import {PoolService} from '../../src/main/p2p/net/PoolService'
import {PEER_KEEPALIVE_DELAY_MS, POOL_REFILL_INTERVAL_MS, POOL_SILENCE_TIMEOUT_MS} from '../../src/main/p2p/constants'

type RawPool = {_connectedPeers: Record<string, unknown>; fills: number; emit: (event: string, ...args: unknown[]) => boolean}
const raw = (service: PoolService): RawPool => service.pool as unknown as RawPool

interface FakePeer {
  host: string
  port: number
  disconnects: number
  sendMessage: () => void
  disconnect: () => void
}

const fakePeer = (host: string): FakePeer => {
  const peer: FakePeer = {
    host, port: 19999, disconnects: 0,
    sendMessage: () => undefined,
    disconnect: () => { peer.disconnects++ },
  }
  return peer
}

const seat = (service: PoolService, peer: FakePeer): void => {
  raw(service)._connectedPeers[peer.host] = peer
  raw(service).emit('peerready', peer)
}

// A VPN dropping or a laptop sleeping kills every socket at once without a RST.
// Nothing closes them, so peerdisconnect never fires and the pool reads full.
describe('pool recovery from a dead link', () => {
  let service: PoolService

  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    service = new PoolService('testnet')
    service.start()
  })

  afterEach(() => {
    service.stop()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('drops peers that have gone silent and redials', () => {
    const peer = fakePeer('1.1.1.1')
    seat(service, peer)
    expect(service.readyPeers.size).toBe(1)
    const fillsBefore = raw(service).fills

    vi.advanceTimersByTime(POOL_SILENCE_TIMEOUT_MS + POOL_REFILL_INTERVAL_MS)

    expect(peer.disconnects).toBe(1)
    expect(service.readyPeers.size).toBe(0)
    expect(service.filterCapablePeers.size).toBe(0)
    expect(raw(service).fills).toBeGreaterThan(fillsBefore)
  })

  it('leaves a pool alone while any peer is still talking', () => {
    const peer = fakePeer('1.1.1.1')
    seat(service, peer)

    for (let elapsed = 0; elapsed < POOL_SILENCE_TIMEOUT_MS * 2; elapsed += POOL_REFILL_INTERVAL_MS) {
      vi.advanceTimersByTime(POOL_REFILL_INTERVAL_MS)
      raw(service).emit('peerinv', peer, {inventory: []})
    }

    expect(peer.disconnects).toBe(0)
    expect(service.readyPeers.size).toBe(1)
  })

  // Every failed dial emits peerdisconnect, so counting those as evidence lets a
  // pool below its minimum churn dials against a dead link forever.
  it('still drops silent peers while failed dials churn', () => {
    const peer = fakePeer('1.1.1.1')
    seat(service, peer)

    for (let elapsed = 0; elapsed < POOL_SILENCE_TIMEOUT_MS + POOL_REFILL_INTERVAL_MS; elapsed += POOL_REFILL_INTERVAL_MS) {
      vi.advanceTimersByTime(POOL_REFILL_INTERVAL_MS)
      raw(service).emit('peerconnect', fakePeer('2.2.2.2'))
      raw(service).emit('peerdisconnect', fakePeer('2.2.2.2'))
    }

    expect(peer.disconnects).toBe(1)
    expect(service.readyPeers.size).toBe(0)
  })

  // dash-core-p2p answers ping but never sends one, so without this the OS never
  // probes and a half-dead socket is indistinguishable from an idle peer.
  it('asks the OS to probe peer sockets', () => {
    const calls: Array<[boolean, number]> = []
    raw(service).emit('peerconnect', {
      socket: {
        setNoDelay: () => undefined,
        setKeepAlive: (on: boolean, delay: number) => { calls.push([on, delay]) },
      },
    })

    expect(calls).toEqual([[true, PEER_KEEPALIVE_DELAY_MS]])
  })
})
