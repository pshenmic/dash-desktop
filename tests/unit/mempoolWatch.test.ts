import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

const captured = vi.hoisted(() => ({pools: [] as Array<Record<string, unknown>>}))

vi.mock('../../src/main/p2p/net/PoolService', async () => {
  const {EventEmitter} = await import('events')
  return {
    PoolService: class extends EventEmitter {
      network: string
      readyPeers = new Set()
      filterCapablePeers = new Set()
      peerServices = new WeakMap()
      messages = {
        GetData: (items: unknown) => ({command: 'getdata', items}),
        MemPool: () => ({command: 'mempool'}),
      }
      constructor(network: string) {
        super()
        this.network = network
        captured.pools.push(this as unknown as Record<string, unknown>)
      }
      start = (): void => undefined
      stop = (): void => undefined
      takeAddresses = (): unknown[] => []
      addAddresses = (): void => undefined
    },
  }
})

import {SyncService} from '../../src/main/p2p/sync/SyncService'
import {MEMPOOL_FETCH_BATCH, MEMPOOL_FETCH_INTERVAL_MS, MEMPOOL_SNAPSHOT_PEERS, NODE_BLOOM} from '../../src/main/p2p/constants'
import type {AppliedTx, WatchAddress} from '../../src/main/p2p/types/walletSync'

const OURS = 'yOurAddress'
const THEIRS = 'yTheirAddress'

const watch = (address: string): WatchAddress => ({address, index: 0, isChange: false, isUsed: false})

// Only the surface onTx reads. Parsing a real wire transaction is
// TransactionMessage's job; what matters here is output matching.
const txPaying = (address: string, satoshis: bigint, txid = '11'.repeat(32)): unknown => ({
  hash: () => txid,
  bytes: () => new Uint8Array([1, 2, 3]),
  inputs: [{txId: '22'.repeat(32), vOut: 0, sequence: 0xffffffff}],
  outputs: [{satoshis, getAddress: () => address}],
})

const txidAt = (i: number): string => i.toString(16).padStart(64, '0')

const wireHash = (txid: string): Uint8Array => {
  const wire = new Uint8Array(32)
  for (let i = 0; i < 32; i++) wire[i] = parseInt(txid.slice((31 - i) * 2, (31 - i) * 2 + 2), 16)
  return wire
}

const invFor = (...txids: string[]): {inventory: Array<{type: number; hash: Uint8Array}>} =>
  ({inventory: txids.map(txid => ({type: 1, hash: wireHash(txid)}))})

const getdata = (peer: {sent: unknown[]}): Array<{items: unknown[]}> =>
  peer.sent.filter(m => (m as {command: string}).command === 'getdata') as Array<{items: unknown[]}>

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
  evonodeDapiUrls: () => undefined,
}

const makePeer = (): {host: string; port: number; sent: unknown[]; sendMessage: (m: unknown) => void} => {
  const sent: unknown[] = []
  return {host: '1.1.1.1', port: 19999, sent, sendMessage: (m: unknown) => sent.push(m)}
}

type FakePool = {
  emit: (e: string, ...a: unknown[]) => void
  readyPeers: Set<unknown>
  peerServices: WeakMap<object, bigint>
}

const seat = (pool: FakePool, peer: object, services = BigInt(NODE_BLOOM)): void => {
  pool.peerServices.set(peer, services)
  pool.readyPeers.add(peer)
  pool.emit('peerready', peer)
}

describe('lock pool mempool watch', () => {
  let service: SyncService
  let incoming: Array<{walletId: string; tx: AppliedTx}>
  let peer: ReturnType<typeof makePeer>

  const emit = (event: string, payload: unknown): void => {
    ;(captured.pools[0] as unknown as {emit: (e: string, ...a: unknown[]) => void})
      .emit(event, peer, payload)
  }

  beforeEach(async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    captured.pools.length = 0
    incoming = []
    peer = makePeer()

    service = new SyncService({
      ...noopEvents,
      incomingTx: (walletId: string, tx: AppliedTx) => incoming.push({walletId, tx}),
    } as never)

    await service.listen({
      type: 'listen',
      network: 'testnet',
      walletId: 'wallet-1',
      watchAddresses: [watch(OURS)],
    })
    seat(captured.pools[0] as unknown as FakePool, peer)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches a mempool tx it has not seen', () => {
    emit('peerinv', invFor('11'.repeat(32)))

    expect(getdata(peer)).toHaveLength(1)
  })

  it('fetches a tx once however many peers announce it', () => {
    const inv = invFor('11'.repeat(32))

    emit('peerinv', inv)
    emit('peerinv', inv)
    emit('peerinv', inv)

    expect(getdata(peer)).toHaveLength(1)
  })

  it('reports a tx paying one of our addresses', () => {
    emit('peertx', {transaction: txPaying(OURS, 250_000n)})

    expect(incoming).toHaveLength(1)
    expect(incoming[0]!.walletId).toBe('wallet-1')
    expect(incoming[0]!.tx.outputs[0]).toMatchObject({address: OURS, satoshis: '250000', isMine: true})
    expect(incoming[0]!.tx.inputs[0]).toMatchObject({vin: 0, prevTxid: '22'.repeat(32), prevVout: 0})
  })

  it('stays silent for a tx that pays nobody we know', () => {
    emit('peertx', {transaction: txPaying(THEIRS, 250_000n)})

    expect(incoming).toEqual([])
  })

  it('does not fetch anything before a wallet supplies addresses', async () => {
    const bare = new SyncService(noopEvents as never)
    captured.pools.length = 0
    await bare.listen({type: 'listen', network: 'testnet'})

    emit('peerinv', invFor('11'.repeat(32)))

    expect(getdata(peer)).toEqual([])
  })
})

describe('mempool watch reporting', () => {
  let logged: string[]

  const report = (service: SyncService): void => {
    ;(service as unknown as {reportMempoolWatch: () => void}).reportMempoolWatch()
  }

  beforeEach(() => {
    logged = []
    vi.spyOn(console, 'info').mockImplementation((...args: unknown[]) => {
      logged.push(String(args[0]))
    })
    captured.pools.length = 0
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // The signal a wallet that never supplied its addresses gives off.
  it('reports a zero watch set rather than staying silent', async () => {
    const bare = new SyncService(noopEvents as never)
    await bare.listen({type: 'listen', network: 'testnet'})

    report(bare)

    expect(logged.some(l => l.includes('mempool watch') && l.includes('watching 0 address'))).toBe(true)
  })

  it('counts announcements, fetches and matches', async () => {
    const service = new SyncService(noopEvents as never)
    await service.listen({
      type: 'listen', network: 'testnet', walletId: 'wallet-1', watchAddresses: [watch(OURS)],
    })
    const peer = makePeer()
    const pool = captured.pools[0] as unknown as FakePool
    seat(pool, peer)
    const inv = invFor('11'.repeat(32))

    pool.emit('peerinv', peer, inv)
    pool.emit('peerinv', peer, inv)
    pool.emit('peertx', peer, {transaction: txPaying(OURS, 1000n)})

    report(service)

    const line = logged.find(l => l.includes('mempool watch'))!
    expect(line).toContain('2 announced')
    expect(line).toContain('1 fetched')
    expect(line).toContain('1 ours')
  })

  it('resets its counters between reports', async () => {
    const service = new SyncService(noopEvents as never)
    await service.listen({
      type: 'listen', network: 'testnet', walletId: 'wallet-1', watchAddresses: [watch(OURS)],
    })
    const peer = makePeer()
    const pool = captured.pools[0] as unknown as {emit: (e: string, ...a: unknown[]) => void}
    pool.emit('peerinv', peer, invFor('11'.repeat(32)))

    report(service)
    logged.length = 0
    report(service)

    expect(logged.find(l => l.includes('mempool watch'))).toContain('0 announced')
  })
})

// A peer relays an inv the first time it sees a tx and never again, so a tx
// already in the mempool when the wallet opens is invisible until it confirms.
describe('mempool request', () => {
  let pool: FakePool

  const listen = async (walletId?: string, addresses: WatchAddress[] = []): Promise<SyncService> => {
    const service = new SyncService(noopEvents as never)
    await service.listen({type: 'listen', network: 'testnet', walletId, watchAddresses: addresses})
    pool = captured.pools[0] as unknown as FakePool
    return service
  }

  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    captured.pools.length = 0
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('asks a bounded quorum of eligible peers', async () => {
    await listen('wallet-1', [watch(OURS)])
    const peers = Array.from({length: MEMPOOL_SNAPSHOT_PEERS + 1}, makePeer)

    for (const peer of peers) seat(pool, peer)

    for (const peer of peers.slice(0, MEMPOOL_SNAPSHOT_PEERS)) {
      expect(peer.sent).toEqual([{command: 'mempool'}])
    }
    expect(peers[MEMPOOL_SNAPSHOT_PEERS]!.sent).toEqual([])
  })

  it('replaces a queried peer that disconnects', async () => {
    await listen('wallet-1', [watch(OURS)])
    const peers = Array.from({length: MEMPOOL_SNAPSHOT_PEERS + 1}, makePeer)
    for (const peer of peers) seat(pool, peer)

    pool.readyPeers.delete(peers[0]!)
    pool.emit('peerdisconnect', peers[0])

    expect(peers[MEMPOOL_SNAPSHOT_PEERS]!.sent).toEqual([{command: 'mempool'}])
  })

  // The request itself is what makes such a peer drop us.
  it('passes over a peer advertising no bloom support', async () => {
    await listen('wallet-1', [watch(OURS)])
    const noBloom = makePeer()
    const next = makePeer()

    seat(pool, noBloom, 0n)
    seat(pool, next)

    expect(noBloom.sent).toEqual([])
    expect(next.sent).toEqual([{command: 'mempool'}])
  })

  it('asks a seated peer once the wallet supplies addresses', async () => {
    const service = await listen()
    const peer = makePeer()
    seat(pool, peer)

    await service.listen({
      type: 'listen', network: 'testnet', walletId: 'wallet-1', watchAddresses: [watch(OURS)],
    })

    expect(peer.sent).toEqual([{command: 'mempool'}])
  })

  // Whatever arrived while the pool was empty was announced to nobody.
  it('asks again after the pool loses every peer', async () => {
    await listen('wallet-1', [watch(OURS)])
    const gone = makePeer()
    seat(pool, gone)
    pool.readyPeers.delete(gone)
    pool.emit('peerdisconnect', gone)
    const replacement = makePeer()

    seat(pool, replacement)

    expect(replacement.sent).toEqual([{command: 'mempool'}])
  })

  it('asks again for the wallet switched to', async () => {
    const service = await listen('wallet-1', [watch(OURS)])
    const peer = makePeer()
    seat(pool, peer)

    await service.listen({
      type: 'listen', network: 'testnet', walletId: 'wallet-2', watchAddresses: [watch(THEIRS)],
    })

    expect(peer.sent).toEqual([{command: 'mempool'}, {command: 'mempool'}])
  })

  it('asks again when the selected wallet address window expands', async () => {
    const service = await listen('wallet-1', [watch(OURS)])
    const peer = makePeer()
    seat(pool, peer)
    const state = service as unknown as {activeWalletId: string; activeWatchAddresses: WatchAddress[]}
    state.activeWalletId = 'wallet-1'
    state.activeWatchAddresses = [watch(OURS)]

    service.addWatchAddresses({type: 'addWatchAddresses', walletId: 'wallet-1', addresses: [watch(THEIRS)]})

    expect(peer.sent).toEqual([{command: 'mempool'}, {command: 'mempool'}])
  })

  it('clears the address matcher when no wallet is supplied', async () => {
    const service = await listen('wallet-1', [watch(OURS)])

    await service.listen({type: 'listen', network: 'testnet'})

    const state = service as unknown as {lockWalletId: string | null; lockAddresses: Set<string>}
    expect(state.lockWalletId).toBeNull()
    expect(state.lockAddresses).toEqual(new Set())
  })
})

// The answer to a `mempool` request is the peer's whole pool in one inv, and
// every entry has to be fetched to see whose it is.
describe('mempool fetch pacing', () => {
  let pool: FakePool
  let peer: ReturnType<typeof makePeer>

  const announce = (count: number, from = peer, first = 0): void => {
    const txids = Array.from({length: count}, (_, i) => txidAt(first + i))
    pool.emit('peerinv', from, invFor(...txids))
  }

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    captured.pools.length = 0

    const service = new SyncService(noopEvents as never)
    await service.listen({
      type: 'listen', network: 'testnet', walletId: 'wallet-1', watchAddresses: [watch(OURS)],
    })
    pool = captured.pools[0] as unknown as FakePool
    peer = makePeer()
    seat(pool, peer)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('asks for one batch and paces the remainder', () => {
    announce(MEMPOOL_FETCH_BATCH + 50)

    expect(getdata(peer)).toHaveLength(1)
    expect(getdata(peer)[0]!.items).toHaveLength(MEMPOOL_FETCH_BATCH)

    vi.advanceTimersByTime(MEMPOOL_FETCH_INTERVAL_MS)

    expect(getdata(peer)).toHaveLength(2)
    expect(getdata(peer)[1]!.items).toHaveLength(50)

    vi.advanceTimersByTime(MEMPOOL_FETCH_INTERVAL_MS * 5)

    expect(getdata(peer)).toHaveLength(2)
  })

  it('leaves a queued tx to be announced again when its peer goes', () => {
    announce(MEMPOOL_FETCH_BATCH + 1)
    pool.readyPeers.delete(peer)

    vi.advanceTimersByTime(MEMPOOL_FETCH_INTERVAL_MS)

    const other = makePeer()
    seat(pool, other)
    announce(1, other, MEMPOOL_FETCH_BATCH)

    expect(getdata(other)).toHaveLength(1)
    expect(getdata(other)[0]!.items).toHaveLength(1)
  })
})
