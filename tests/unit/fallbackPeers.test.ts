import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

const captured = vi.hoisted(() => ({pools: [] as Array<Record<string, unknown>>}))

vi.mock('dash-core-p2p', async () => {
  const {EventEmitter} = await import('events')
  return {
    Messages: class {},
    Networks: {get: (network: string) => ({name: network, port: network === 'mainnet' ? 9999 : 19999, dnsSeeds: ['seed.example']})},
    NODE_COMPACT_FILTERS: 64,
    Pool: class extends EventEmitter {
      _addrs: unknown[] = []
      _connectedPeers = {}
      network: {port: number; dnsSeeds: string[]}
      dnsSeed = true
      maxSize = 0
      constructor(options: {network: {port: number; dnsSeeds: string[]}}) {
        super()
        this.network = options.network
        captured.pools.push(this as unknown as Record<string, unknown>)
      }
      connect = (): void => undefined
      disconnect = (): void => undefined
      numberConnected = (): number => 0
      _addAddr = (addr: unknown): void => { this._addrs.push(addr) }
      _fillConnections = (): void => undefined
    },
  }
})

import {PoolService} from '../../src/main/p2p/PoolService'
import {FALLBACK_PEERS, POOL_FALLBACK_TICKS, POOL_REFILL_INTERVAL_MS} from '../../src/main/p2p/constants'
import {Network} from '../../src/main/src/types'

const dialled = (service: PoolService): string[] =>
  ((service.pool as unknown as {_addrs: Array<{ip: {v4?: string; v6?: string}; port: number}>})._addrs)
    .map(a => `${a.ip.v4 ?? a.ip.v6}:${a.port}`)

const tick = (times: number): void => {
  vi.advanceTimersByTime(POOL_REFILL_INTERVAL_MS * times)
}

describe('built-in peer fallback', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    captured.pools.length = 0
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('stays out of the way while discovery is producing peers', () => {
    const service = new PoolService('testnet')
    service.start()
    service.readyPeers.add({} as never)

    tick(POOL_FALLBACK_TICKS + 2)

    expect(dialled(service)).toEqual([])
    service.stop()
  })

  it('dials the built-in addresses once nothing has connected', () => {
    const service = new PoolService('testnet')
    service.start()

    tick(POOL_FALLBACK_TICKS)

    expect(dialled(service)).toEqual(FALLBACK_PEERS.testnet)
    service.stop()
  })

  it('waits out the grace period first', () => {
    const service = new PoolService('testnet')
    service.start()

    tick(POOL_FALLBACK_TICKS - 1)

    expect(dialled(service)).toEqual([])
    service.stop()
  })

  it('dials them only once, however long the pool stays empty', () => {
    const service = new PoolService('testnet')
    service.start()

    tick(POOL_FALLBACK_TICKS * 6)

    expect(dialled(service)).toEqual(FALLBACK_PEERS.testnet)
    service.stop()
  })

  it('picks the list matching the pool network', () => {
    const service = new PoolService('mainnet')
    service.start()

    tick(POOL_FALLBACK_TICKS)

    expect(dialled(service)).toEqual(FALLBACK_PEERS.mainnet)
    service.stop()
  })

  it('resets the count when a peer connects before the grace period is up', () => {
    const service = new PoolService('testnet')
    service.start()

    tick(POOL_FALLBACK_TICKS - 1)
    const peer = {} as never
    service.readyPeers.add(peer)
    tick(1)
    service.readyPeers.delete(peer)
    tick(POOL_FALLBACK_TICKS - 1)

    expect(dialled(service)).toEqual([])
    service.stop()
  })
})

describe('the built-in peer lists themselves', () => {
  const networks: Network[] = ['mainnet', 'testnet']

  it.each(networks)('%s entries all carry that network\'s port', network => {
    const port = network === 'mainnet' ? '9999' : '19999'

    for (const entry of FALLBACK_PEERS[network]) {
      expect(entry.endsWith(`:${port}`)).toBe(true)
    }
  })

  it.each(networks)('%s holds no duplicates', network => {
    expect(new Set(FALLBACK_PEERS[network]).size).toBe(FALLBACK_PEERS[network].length)
  })

  // A list that has decayed to one operator is a list that fails all at once.
  it.each(networks)('%s spreads across several /16s', network => {
    const subnets = new Set(FALLBACK_PEERS[network].map(entry => entry.split('.').slice(0, 2).join('.')))

    expect(subnets.size).toBeGreaterThanOrEqual(3)
  })
})
