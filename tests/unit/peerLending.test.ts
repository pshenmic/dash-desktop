import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

vi.mock('dash-core-p2p', async () => {
  const {EventEmitter} = await import('events')
  return {
    Messages: class {
      GetAddr = (): {command: string} => ({command: 'getaddr'})
      Ping = (): {command: string; nonce: Uint8Array} => ({command: 'ping', nonce: new Uint8Array(8)})
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
import {PeerRegistry} from '../../src/main/p2p/net/peerRegistry'
import {bulkPeerShare} from '../../src/main/p2p/net/peerOverrides'

interface FakePeer {
  host: string
  port: number
  subversion: string | null
  disconnects: number
  sendMessage: (message: unknown) => void
  disconnect: () => void
}

const fakePeer = (host: string, port = 19999): FakePeer => {
  const peer: FakePeer = {
    host, port, subversion: '/Dash Core:22.1.0/', disconnects: 0,
    sendMessage: () => undefined,
    disconnect: () => { peer.disconnects++ },
  }
  return peer
}

type RawPool = {
  _connectedPeers: Record<string, unknown>
  _addrs: Array<{ip: {v4?: string; v6?: string}; port: number}>
  emit: (event: string, ...args: unknown[]) => boolean
}
const raw = (service: PoolService): RawPool => service.pool as unknown as RawPool

let seatKey = 0
const seat = (service: PoolService, peer: FakePeer): void => {
  raw(service)._connectedPeers[`seat${seatKey++}`] = peer
  raw(service).emit('peerconnect', peer)
  if (peer.disconnects === 0) raw(service).emit('peerready', peer)
}

describe('sharing the user peers out', () => {
  it('keeps the first entry and lends every second one', () => {
    expect(bulkPeerShare(['1.1.1.1:19999'])).toEqual([])
    expect(bulkPeerShare(['1.1.1.1:19999', '2.2.2.2:19999', '3.3.3.3:19999']))
      .toEqual(['2.2.2.2:19999'])
    expect(bulkPeerShare()).toEqual([])
  })
})

describe('peers a pool lends', () => {
  let lock: PoolService
  let bulk: PoolService

  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    seatKey = 0
    const registry = new PeerRegistry()
    lock = new PoolService('testnet', {registry, label: 'lock-pool', peers: ['1.1.1.1:19999', '2.2.2.2:19999']})
    bulk = new PoolService('testnet', {registry, label: 'bulk-pool', peers: ['2.2.2.2:19999']})
  })

  afterEach(() => {
    lock.stop()
    bulk.stop()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('drops the socket and the book entry, and keeps the rest', () => {
    lock.start()
    const lent = fakePeer('2.2.2.2')
    const kept = fakePeer('1.1.1.1')
    seat(lock, lent)
    seat(lock, kept)

    lock.dropPeers(['2.2.2.2:19999'])

    expect(lent.disconnects).toBe(1)
    expect(kept.disconnects).toBe(0)
    expect(raw(lock)._addrs.map(a => a.ip.v4)).toEqual(['1.1.1.1'])
  })

  // The whole point of lending: the pool taking over dials before the losing
  // pool's disconnect event lands, so the claim cannot wait for it.
  it('frees the node for the pool it was lent to', () => {
    lock.start()
    seat(lock, fakePeer('2.2.2.2'))

    const refused = fakePeer('2.2.2.2')
    seat(bulk, refused)
    expect(refused.disconnects).toBe(1)

    lock.dropPeers(['2.2.2.2:19999'])
    const seated = fakePeer('2.2.2.2')
    seat(bulk, seated)

    expect(seated.disconnects).toBe(0)
    expect(bulk.peerInfo().map(p => p.host)).toEqual(['2.2.2.2'])
  })

  // Written without a port by hand, or dialled on the network default: the
  // entry the pool filed is the entry it has to drop.
  it('lends a peer the user wrote without a port', () => {
    lock.start()
    const lent = fakePeer('2.2.2.2')
    seat(lock, lent)

    lock.dropPeers(['2.2.2.2'])

    expect(lent.disconnects).toBe(1)
    expect(raw(lock)._addrs.map(a => a.ip.v4)).toEqual(['1.1.1.1'])
  })
})
