import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

vi.mock('dash-core-p2p', async () => {
  const {EventEmitter} = await import('events')
  return {
    Messages: class {
      Ping = (): {command: string; nonce: Uint8Array} => ({command: 'ping', nonce: new Uint8Array(8)})
    },
    Networks: {get: (network: string) => ({name: network, port: network === 'mainnet' ? 9999 : 19999, dnsSeeds: ['seed.example']})},
    NODE_COMPACT_FILTERS: 64,
    Pool: class extends EventEmitter {
      _addrs: Array<{ip: {v4?: string; v6?: string}; port: number}> = []
      _connectedPeers = {}
      network: {port: number; dnsSeeds: string[]}
      dnsSeed: boolean
      maxSize = 0
      fills = 0
      constructor(options: {network: {port: number; dnsSeeds: string[]}; maxSize: number; dnsSeed?: boolean}) {
        super()
        this.network = options.network
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
import {POOL_MAX_CONNECTIONS, POOL_READY_PEERS} from '../../src/main/p2p/constants'

type RawPool = {maxSize: number; fills: number; _addrs: Array<{ip: {v4?: string; v6?: string}; port: number}>}
const raw = (service: PoolService): RawPool => service.pool as unknown as RawPool
const dialled = (service: PoolService): string[] =>
  raw(service)._addrs.map(a => `${a.ip.v4 ?? a.ip.v6}:${a.port}`)

// Both cases below were measured as a fixed wait before the first getheaders
// went out, not as anything the network did.
describe('pool startup fill', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('opens to the dial cap and fills without waiting for a refill tick', () => {
    const service = new PoolService('testnet')

    expect(raw(service).maxSize).toBe(POOL_READY_PEERS)
    service.start()

    expect(raw(service).maxSize).toBe(POOL_MAX_CONNECTIONS)
    expect(raw(service).fills).toBe(1)
    service.stop()
  })

  // FALLBACK_PEERS overlaps what the DNS seed returns, so the lock pool is
  // already connected to those hosts. A node dialled twice from one machine
  // drops both connections, which is why widening capacity must not reach for
  // that list — it stays the last resort it was.
  it('dials nothing it was not handed', () => {
    const service = new PoolService('testnet', {dnsSeed: false})

    service.start()

    expect(dialled(service)).toEqual([])
    service.stop()
  })

  it('dials only the book it was handed', () => {
    const service = new PoolService('testnet', {dnsSeed: false, peers: ['1.2.3.4:19999']})

    service.start()

    expect(dialled(service)).toEqual(['1.2.3.4:19999'])
    service.stop()
  })
})
