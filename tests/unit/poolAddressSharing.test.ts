import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

vi.mock('dash-core-p2p', async () => {
  const {EventEmitter} = await import('events')
  return {
    Messages: class {},
    Networks: {get: (network: string) => ({name: network, port: network === 'mainnet' ? 9999 : 19999, dnsSeeds: ['seed.example']})},
    NODE_COMPACT_FILTERS: 64,
    Pool: class extends EventEmitter {
      _addrs: Array<{hash: string; retryTime?: number}> = []
      _connectedPeers: Record<string, unknown> = {}
      network = {port: 19999, dnsSeeds: []}
      dnsSeed = true
      maxSize = 0
      connect = (): void => undefined
      disconnect = (): void => undefined
      numberConnected = (): number => 0
      _addAddr = (addr: {hash: string}): void => { this._addrs.push(addr) }
      _fillConnections = (): void => undefined
    },
  }
})

import {PoolService} from '../../src/main/p2p/net/PoolService'
import {POOL_ADDRESS_RESERVE} from '../../src/main/p2p/constants'

type RawPool = {
  _addrs: Array<{hash: string; retryTime?: number}>
  _connectedPeers: Record<string, unknown>
}

const raw = (service: PoolService): RawPool => service.pool as unknown as RawPool

function withAddresses(count: number): PoolService {
  const service = new PoolService('testnet')
  raw(service)._addrs = Array.from({length: count}, (_, i) => ({hash: `h${i}`}))
  return service
}

describe('sharing addresses between pools', () => {
  beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => undefined))
  afterEach(() => vi.restoreAllMocks())

  // The observed starvation: this runs on every gossip and every peer change,
  // so a fractional share compounded down to 33 addresses and two peers.
  it('gives away nothing while the book is at or below the reserve', () => {
    const service = withAddresses(POOL_ADDRESS_RESERVE)

    expect(service.takeAddresses()).toEqual([])
    expect(raw(service)._addrs).toHaveLength(POOL_ADDRESS_RESERVE)
  })

  it('gives away nothing when repeatedly asked at the reserve', () => {
    const service = withAddresses(POOL_ADDRESS_RESERVE)

    for (let i = 0; i < 20; i++) service.takeAddresses()

    expect(raw(service)._addrs).toHaveLength(POOL_ADDRESS_RESERVE)
  })

  it('hands over only the surplus', () => {
    const service = withAddresses(POOL_ADDRESS_RESERVE + 50)

    expect(service.takeAddresses()).toHaveLength(50)
    expect(raw(service)._addrs).toHaveLength(POOL_ADDRESS_RESERVE)
  })

  it('removes what it hands over, so the same address is never in both pools', () => {
    const service = withAddresses(POOL_ADDRESS_RESERVE + 10)

    const taken = new Set(service.takeAddresses().map(a => a.hash))
    const kept = raw(service)._addrs.map(a => a.hash)

    expect(kept.some(hash => taken.has(hash as string))).toBe(false)
  })

  // Connected and backing-off addresses are not candidates, so counting them
  // toward the reserve would hand out addresses the pool still needs.
  it('counts only spare addresses toward the reserve', () => {
    const service = withAddresses(POOL_ADDRESS_RESERVE + 30)
    const pool = raw(service)
    for (const addr of pool._addrs.slice(0, 20)) pool._connectedPeers[addr.hash] = {}
    for (const addr of pool._addrs.slice(20, 40)) addr.retryTime = Date.now()

    expect(service.takeAddresses()).toHaveLength(0)
  })

  it('shares again once gossip pushes it back above the reserve', () => {
    const service = withAddresses(POOL_ADDRESS_RESERVE)
    expect(service.takeAddresses()).toEqual([])

    service.addAddresses(Array.from({length: 40}, (_, i) => ({hash: `new${i}`} as never)))

    expect(service.takeAddresses()).toHaveLength(40)
  })
})
