import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

const captured = vi.hoisted(() => ({pools: [] as Array<Record<string, unknown>>}))

vi.mock('../../src/main/p2p/net/PoolService', async () => {
  const {EventEmitter} = await import('events')
  return {
    PoolService: class extends EventEmitter {
      network: string
      readyPeers = new Set()
      filterCapablePeers = new Set()
      messages = {GetData: (items: unknown) => ({command: 'getdata', items})}
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

const invFor = (txid: string): {inventory: Array<{type: number; hash: Uint8Array}>} => {
  const wire = new Uint8Array(32)
  for (let i = 0; i < 32; i++) wire[i] = parseInt(txid.slice((31 - i) * 2, (31 - i) * 2 + 2), 16)
  return {inventory: [{type: 1, hash: wire}]}
}

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

const makePeer = (): {host: string; sent: unknown[]; sendMessage: (m: unknown) => void} => {
  const sent: unknown[] = []
  return {host: '1.1.1.1', sent, sendMessage: (m: unknown) => sent.push(m)}
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
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches a mempool tx it has not seen', () => {
    emit('peerinv', invFor('11'.repeat(32)))

    expect(peer.sent).toHaveLength(1)
  })

  it('fetches a tx once however many peers announce it', () => {
    const inv = invFor('11'.repeat(32))

    emit('peerinv', inv)
    emit('peerinv', inv)
    emit('peerinv', inv)

    expect(peer.sent).toHaveLength(1)
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

    expect(peer.sent).toEqual([])
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
    const pool = captured.pools[0] as unknown as {emit: (e: string, ...a: unknown[]) => void}
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
