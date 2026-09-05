import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

const captured = vi.hoisted(() => ({
  pools: [] as Array<{options: Record<string, unknown>; stopped: boolean; bans: string[][]; lent: string[][]; returned: string[][]}>,
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
      entry: {options: Record<string, unknown>; stopped: boolean; bans: string[][]; lent: string[][]; returned: string[][]}
      constructor(network: string, options: Record<string, unknown> = {}) {
        super()
        this.network = network
        this.entry = {options, stopped: false, bans: [], lent: [], returned: []}
        captured.pools.push(this.entry)
      }
      setBanned = (banned: string[]): void => { this.entry.bans.push(banned) }
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
      addPeers = (entries: string[]): void => { this.entry.returned.push(entries) }
      dropPeers = (entries: string[]): void => { this.entry.lent.push(entries) }
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

const PINNED: PeerOverrides = {mode: 'static', dnsSeeds: [], staticPeers: ['1.2.3.4:19999'], dynamicPeers: [], bannedPeers: []}
const DYNAMIC: PeerOverrides = {mode: 'dynamic', dnsSeeds: [], staticPeers: [], dynamicPeers: [], bannedPeers: []}

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
      pinnedOnly: true,
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
    expect(captured.pools[1]!.options).toMatchObject({pinnedOnly: true})
  })

  it('leaves the pool alone when they do not', async () => {
    await service.listen({type: 'listen', network: 'testnet', peerOverrides: PINNED})
    await service.listen({type: 'listen', network: 'testnet', peerOverrides: {...PINNED}})

    expect(captured.pools).toHaveLength(1)
  })

  // Dynamic mode dials these on top of DNS and gossip; the pinned list is not
  // what it reads. A lone peer stays on the pool rpc mode also runs.
  it('hands the dynamic peers to the pools discovery runs', async () => {
    await start(service, {...DYNAMIC, staticPeers: ['1.2.3.4:19999'], dynamicPeers: ['5.6.7.8:19999']})

    expect(captured.pools).toHaveLength(2)
    expect(captured.pools[0]!.options).toMatchObject({label: 'lock-pool', peers: ['5.6.7.8:19999']})
    expect(captured.pools[1]!.options).toMatchObject({label: 'bulk-pool', peers: []})
    expect(captured.pools[0]!.lent).toEqual([[]])
  })

  // One node answering two sockets from this host drops both, so the pools
  // share the list out instead of each dialling all of it.
  it('lends the bulk pool its share of the dynamic peers', async () => {
    await start(service, {...DYNAMIC, dynamicPeers: ['1.1.1.1:19999', '2.2.2.2:19999', '3.3.3.3:19999']})

    expect(captured.pools[1]!.options).toMatchObject({label: 'bulk-pool', peers: ['2.2.2.2:19999']})
    expect(captured.pools[0]!.lent).toEqual([['2.2.2.2:19999']])
  })

  // The lock pool outlives the bulk one and is all rpc mode has, so what it lent
  // comes back by name — takeAddresses only moves what is spare, and a peer the
  // user named is the entry most likely to be connected.
  it('takes the lent peers back when the sync layer stops', async () => {
    await start(service, {...DYNAMIC, dynamicPeers: ['1.1.1.1:19999', '2.2.2.2:19999']})
    await service.stop()

    expect(captured.pools[0]!.returned).toEqual([['2.2.2.2:19999']])
  })

  // The pool is built from the list its own mode dials, so editing the other
  // one would cost a synced session for a pool rebuilt identically.
  it('leaves the pool standing when only the other mode\'s list changes', async () => {
    await service.listen({type: 'listen', network: 'testnet', peerOverrides: PINNED})
    await service.listen({
      type: 'listen',
      network: 'testnet',
      peerOverrides: {...PINNED, dynamicPeers: ['5.6.7.8:19999'], dnsSeeds: ['seed.example.com']},
    })

    expect(captured.pools).toHaveLength(1)
  })

  // Bans are the one setting a listen carries that does not rebuild the pool, so
  // they have to reach the running one rather than the field it was built from.
  it('pushes a ban a listen carries into the pool it left standing', async () => {
    await service.listen({type: 'listen', network: 'testnet', peerOverrides: PINNED})
    await service.listen({
      type: 'listen',
      network: 'testnet',
      peerOverrides: {...PINNED, bannedPeers: ['9.9.9.9']},
    })

    expect(captured.pools).toHaveLength(1)
    expect(captured.pools[0]!.bans).toEqual([['9.9.9.9']])
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
