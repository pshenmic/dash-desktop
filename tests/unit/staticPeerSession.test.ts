import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

const captured = vi.hoisted(() => ({
  pools: [] as Array<{options: Record<string, unknown>; stopped: boolean}>,
  headerPools: [] as unknown[],
}))

vi.mock('../../src/main/p2p/store/ChainStore', () => ({
  ChainStore: class {
    network: string
    constructor(_path: string, network: string) {
      this.network = network
    }
    open = async (): Promise<void> => undefined
    close = async (): Promise<void> => undefined
    initSyncState = async (): Promise<{tipHeight: number; tipHash: string}> =>
      ({tipHeight: 100, tipHash: 'aa'.repeat(32)})
  },
}))

vi.mock('../../src/main/p2p/net/PoolService', async () => {
  const {EventEmitter} = await import('events')
  return {
    PoolService: class extends EventEmitter {
      network: string
      readyPeers = new Set()
      filterCapablePeers = new Set()
      messages = {}
      entry: {options: Record<string, unknown>; stopped: boolean}
      constructor(network: string, options: Record<string, unknown> = {}) {
        super()
        this.network = network
        this.entry = {options, stopped: false}
        captured.pools.push(this.entry)
      }
      start = (): void => undefined
      stop = (): void => { this.entry.stopped = true }
      peerInfo = (): unknown[] => [{
        pool: this.entry.options.label ?? 'pool',
        host: '1.2.3.4',
        port: 19999,
        userAgent: '/Dash Core:22.1.0/',
        pingMs: 12,
      }]
      takeAddresses = (): unknown[] => []
      addAddresses = (): void => undefined
    },
  }
})

vi.mock('../../src/main/p2p/sync/workers/HeaderSyncWorker', async () => {
  const {EventEmitter} = await import('events')
  return {
    HeaderSyncWorker: class extends EventEmitter {
      constructor(options: {peerPool: unknown}) {
        super()
        captured.headerPools.push(options.peerPool)
      }
      setFinalityHeight = (): void => undefined
      start = async (): Promise<void> => undefined
      stop = (): void => undefined
    },
  }
})

vi.mock('../../src/main/p2p/sync/workers/CFilterSyncWorker', async () => {
  const {EventEmitter} = await import('events')
  return {
    CFilterSyncWorker: class extends EventEmitter {
      onChainRewound = (): void => undefined
      onChainExtended = (): void => undefined
      start = async (): Promise<void> => undefined
      stop = (): void => undefined
    },
  }
})

import {SyncService} from '../../src/main/p2p/sync/SyncService'
import type {PeerOverrides} from '../../src/main/p2p/types/pool'

const PINNED: PeerOverrides = {mode: 'static', dnsSeeds: [], peers: ['1.2.3.4:19999']}
const DYNAMIC: PeerOverrides = {mode: 'dynamic', dnsSeeds: [], peers: []}

const noopEvents = {
  status: () => undefined,
  blockApplied: () => undefined,
  cursorAdvanced: () => undefined,
  cursorReset: () => undefined,
  chainRewound: () => undefined,
  incomingTx: () => undefined,
  gapExhausted: () => undefined,
  error: () => undefined,
  broadcastResult: () => undefined,
  txInstantLocked: () => undefined,
  chainLocked: () => undefined,
}

const start = (service: SyncService, peerOverrides: PeerOverrides): Promise<void> => service.start({
  type: 'start',
  network: 'testnet',
  walletId: 'wallet-1',
  chainDbPath: '/tmp/chain.db',
  watchAddresses: [],
  gapLimit: 20,
  seedUtxos: [],
  cfilterCursor: null,
  peerOverrides,
})

describe('static peers run one pool', () => {
  let service: SyncService

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    captured.pools.length = 0
    captured.headerPools.length = 0
    service = new SyncService(noopEvents)
  })
  afterEach(() => vi.restoreAllMocks())

  it('syncs on the pool that watches locks, sized to the pinned set', async () => {
    await start(service, PINNED)

    expect(captured.pools).toHaveLength(1)
    expect(captured.pools[0]!.options).toMatchObject({
      staticPeers: true,
      relay: true,
      peers: ['1.2.3.4:19999'],
      readyPeers: 1,
      minPeers: 1,
      maxConnections: 1,
    })
  })

  it('gives the header worker that same pool', async () => {
    await start(service, PINNED)

    expect(captured.headerPools).toHaveLength(1)
    expect((captured.headerPools[0] as {entry: unknown}).entry).toBe(captured.pools[0])
  })

  it('leaves the pinned pool up when the sync layer stops', async () => {
    await start(service, PINNED)
    await service.stop()

    expect(captured.pools[0]!.stopped).toBe(false)
  })

  it('still runs a separate bulk pool under dynamic peers', async () => {
    await start(service, DYNAMIC)

    expect(captured.pools).toHaveLength(2)
    expect(captured.pools[1]!.options).toMatchObject({label: 'bulk-pool', relay: false, dnsSeed: false})
  })

  // The pool is built from the settings, so an edit only lands by replacing it.
  it('rebuilds the pool when the peer settings change', async () => {
    await service.listen({type: 'listen', network: 'testnet', peerOverrides: DYNAMIC})
    await service.listen({type: 'listen', network: 'testnet', peerOverrides: PINNED})

    expect(captured.pools).toHaveLength(2)
    expect(captured.pools[0]!.stopped).toBe(true)
    expect(captured.pools[1]!.options).toMatchObject({staticPeers: true})
  })

  it('leaves the pool alone when they do not', async () => {
    await service.listen({type: 'listen', network: 'testnet', peerOverrides: PINNED})
    await service.listen({type: 'listen', network: 'testnet', peerOverrides: {...PINNED}})

    expect(captured.pools).toHaveLength(1)
  })

  // Both peer modes answer, and in dynamic mode that means both pools: a peer
  // serving headers is one the wallet is connected to just as much as a peer
  // serving locks.
  it('reports the peers of every pool it is running', async () => {
    await start(service, PINNED)

    expect(service.getPeers().map(p => p.pool)).toEqual(['static-pool'])

    await service.stop()
    captured.pools.length = 0
    service = new SyncService(noopEvents)
    await start(service, DYNAMIC)

    expect(service.getPeers().map(p => p.pool)).toEqual(['lock-pool', 'bulk-pool'])
  })

  it('reports no peer while no pool is up', () => {
    expect(service.getPeers()).toEqual([])
  })

  // Reported off the pool that is up, not off the preference that asked for it:
  // the two differ for as long as a rebuild takes.
  it('reports the running mode in the status', async () => {
    expect(service.getStatus().peerMode).toBeNull()

    await service.listen({type: 'listen', network: 'testnet', peerOverrides: PINNED})
    expect(service.getStatus().peerMode).toBe('static')

    await service.listen({type: 'listen', network: 'testnet', peerOverrides: DYNAMIC})
    expect(service.getStatus().peerMode).toBe('dynamic')
  })
})
