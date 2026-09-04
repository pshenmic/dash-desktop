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
import {POOL_REFILL_INTERVAL_MS} from '../../src/main/p2p/constants'

interface FakePeer {
  host: string
  port: number
  subversion: string | null
  disconnects: number
  sent: unknown[]
  sendMessage: (message: unknown) => void
  disconnect: () => void
}

const fakePeer = (host: string, port = 19999): FakePeer => {
  const peer: FakePeer = {
    host, port, subversion: '/Dash Core:22.1.0/', disconnects: 0, sent: [],
    sendMessage: message => { peer.sent.push(message) },
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

describe('peers a pool refuses', () => {
  let service: PoolService

  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    seatKey = 0
  })

  afterEach(() => {
    service.stop()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('never seats a banned peer that dials', () => {
    service = new PoolService('testnet', {banned: ['68.67.122.38:19999']})
    service.start()

    const peer = fakePeer('68.67.122.38')
    seat(service, peer)

    expect(peer.disconnects).toBe(1)
    expect(service.peerInfo()).toEqual([])
  })

  // The point of a ban: the socket goes now, not when the pool next turns over.
  it('drops a peer it is already connected to', () => {
    service = new PoolService('testnet')
    service.start()
    const banned = fakePeer('68.67.122.38')
    const kept = fakePeer('89.169.164.19')
    seat(service, banned)
    seat(service, kept)

    service.setBanned(['68.67.122.38:19999'])

    expect(banned.disconnects).toBe(1)
    expect(kept.disconnects).toBe(0)
    expect(service.peerInfo().map(p => p.host)).toEqual(['89.169.164.19'])
  })

  // Gossip hands the same node back every few seconds, so the book has to be
  // swept as well as the sockets.
  it('drops banned entries from the address book', () => {
    service = new PoolService('testnet')
    service.start()
    raw(service)._addrs = [
      {ip: {v4: '68.67.122.38'}, port: 19999},
      {ip: {v4: '89.169.164.19'}, port: 19999},
    ]

    service.setBanned(['68.67.122.38:19999'])
    raw(service)._addrs.push({ip: {v4: '68.67.122.38'}, port: 19999})
    vi.advanceTimersByTime(POOL_REFILL_INTERVAL_MS)

    expect(raw(service)._addrs.map(a => a.ip.v4)).toEqual(['89.169.164.19'])
  })

  // A masternode answers on several ports, and each is its own node to the
  // pool: the one dialled is the one banned.
  it('matches the port the entry names and no other', () => {
    service = new PoolService('testnet', {banned: ['68.67.122.38:19997']})
    service.start()

    const banned = fakePeer('68.67.122.38', 19997)
    const kept = fakePeer('68.67.122.38', 19999)
    seat(service, banned)
    seat(service, kept)

    expect(banned.disconnects).toBe(1)
    expect(kept.disconnects).toBe(0)
  })

  // What setBannedPeers refuses, so this is only reachable by hand-editing
  // preferences: a ban matches a socket, and no socket is spelled without a port.
  it('ignores an entry written without a port', () => {
    service = new PoolService('testnet', {banned: ['68.67.122.38']})
    service.start()

    const peer = fakePeer('68.67.122.38')
    seat(service, peer)

    expect(peer.disconnects).toBe(0)
  })

  it('lets a peer back once its ban is lifted', () => {
    service = new PoolService('testnet', {banned: ['68.67.122.38:19999']})
    service.start()
    seat(service, fakePeer('68.67.122.38'))

    service.setBanned([])
    const again = fakePeer('68.67.122.38')
    seat(service, again)

    expect(again.disconnects).toBe(0)
    expect(service.peerInfo().map(p => p.host)).toEqual(['68.67.122.38'])
  })

  // Static mode dials nothing but the pinned list, and a ban outranks it.
  it('refuses a pinned peer the user banned', () => {
    service = new PoolService('testnet', {
      staticPeers: true, peers: ['68.67.122.38:19999'], banned: ['68.67.122.38:19999'],
    })
    service.start()

    const peer = fakePeer('68.67.122.38')
    seat(service, peer)
    vi.advanceTimersByTime(POOL_REFILL_INTERVAL_MS)

    expect(peer.disconnects).toBe(1)
    expect(raw(service)._addrs).toEqual([])
  })

  // addAddresses dials as soon as it has written the book, so an entry that
  // reaches it is a connect attempt — the filter has to come first.
  it('never files a banned address it is handed', () => {
    service = new PoolService('testnet', {banned: ['68.67.122.38:19999']})
    service.start()

    service.addAddresses([
      {ip: {v4: '68.67.122.38'}, port: 19999},
      {ip: {v6: '0000:0000:0000:0000:0000:ffff:4443:7a26', v4: '68.67.122.38'}, port: 19999},
      {ip: {v4: '89.169.164.19'}, port: 19999},
    ] as never)

    expect(raw(service)._addrs.map(a => a.ip.v4)).toEqual(['89.169.164.19'])
  })

  // The pool files gossip itself, before this pool service sees the event. Every
  // disconnect triggers a fill, so surviving the event is enough to be dialled.
  it('sweeps a banned address gossip filed, in the same event', () => {
    service = new PoolService('testnet', {banned: ['68.67.122.38:19999']})
    service.start()

    const gossiped = [
      {ip: {v4: '68.67.122.38'}, port: 19999},
      {ip: {v4: '89.169.164.19'}, port: 19999},
    ]
    raw(service)._addrs.push(...gossiped)
    raw(service).emit('peeraddr', fakePeer('89.169.164.19'), {addresses: gossiped})

    expect(raw(service)._addrs.map(a => a.ip.v4)).toEqual(['89.169.164.19'])
  })

  // The sweep walks the whole book, on a thread that is also parsing sync
  // responses, so it runs only for a message that carried something banned.
  it('leaves the book alone when nothing banned arrived', () => {
    service = new PoolService('testnet', {banned: ['68.67.122.38:19999']})
    service.start()

    const gossiped = [{ip: {v4: '89.169.164.19'}, port: 19999}]
    raw(service)._addrs.push(
      {ip: {v4: '5.6.7.8'}, port: 19999},
      {ip: {v4: '5.6.7.8'}, port: 19999},
      ...gossiped,
    )
    raw(service).emit('peeraddr', fakePeer('89.169.164.19'), {addresses: gossiped})

    expect(raw(service)._addrs).toHaveLength(3)
  })

  // A peer reports the bare address, so an entry written the way the peer list
  // takes it would match nothing.
  it('matches a v6 entry written with brackets', () => {
    service = new PoolService('testnet', {banned: ['[2001:db8::1]:19999']})
    service.start()

    const peer = fakePeer('2001:db8::1')
    seat(service, peer)

    expect(peer.disconnects).toBe(1)
  })
})
