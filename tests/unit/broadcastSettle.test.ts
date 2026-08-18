import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {EventEmitter} from 'events'

const captured = vi.hoisted(() => ({session: null as unknown as FakeSession, ready: [] as Array<{host: string; port: number}>}))

type FakePeer = {host: string; port: number}

// Models the half of dash-core-p2p's TxBroadcast that policy depends on: who
// was invited, who took the bytes, and who announced the txid back.
class FakeSession extends EventEmitter {
  txid = 'txid-1'
  invSentTo = new Set<FakePeer>()
  txSentTo = new Set<FakePeer>()
  requestedBy = new Set<FakePeer>()
  propagatedFrom = new Set<FakePeer>()
  instantLocked = false
  rejections: unknown[] = []
  ready: FakePeer[] = captured.ready
  close = vi.fn()
  push = vi.fn()

  readyPeers = (): FakePeer[] => this.ready

  announce = (peer?: FakePeer): FakePeer[] => {
    const targets = peer ? [peer] : this.ready
    const sent = targets.filter(p => !this.invSentTo.has(p))
    for (const p of sent) this.invSentTo.add(p)
    return sent
  }

  // A peer that was invited took the bytes. Core will not relay the tx back
  // toward it, so it can never appear in propagatedFrom.
  deliverToInvited(): void {
    for (const p of this.invSentTo) {
      this.txSentTo.add(p)
      this.emit('sent', p)
    }
  }

  witnessAnnounces(peer: FakePeer): void {
    this.propagatedFrom.add(peer)
    this.emit('propagated', peer)
  }
}

vi.mock('dash-core-p2p', () => ({
  TxBroadcast: class {
    constructor() {
      captured.session = new FakeSession()
      return captured.session as never
    }
  },
}))

vi.mock('dash-core-sdk', () => ({
  Transaction: {fromHex: vi.fn(() => ({hash: (): string => 'txid-1'}))},
}))

import {BroadcastService} from '../../src/main/p2p/net/BroadcastService'
import {BROADCAST_POLICY} from '../../src/main/p2p/constants'
import {PoolService} from '../../src/main/p2p/net/PoolService'

const {minPeerAcks, witnessPeers, timeoutMs} = BROADCAST_POLICY

function start(readyCount: number): Promise<unknown> {
  captured.ready = Array.from({length: readyCount}, (_, i) => ({host: `10.0.0.${i}`, port: 19999}))
  const pool = {numberConnected: (): number => readyCount}
  const poolService = Object.assign(new EventEmitter(), {pool}) as unknown as PoolService
  return new BroadcastService(poolService).broadcast('00')
}

describe('what a broadcast accepts as proof', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // The observed failure: every peer took the bytes, none could announce the
  // txid back, and the wallet called it a success.
  it('refuses delivery alone, however many peers took the bytes', async () => {
    const settled = expect(start(minPeerAcks + witnessPeers + 3)).rejects.toThrow(/no witness saw the tx/)
    captured.session.deliverToInvited()

    await vi.advanceTimersByTimeAsync(timeoutMs)

    await settled
  })

  it('leaves peers uninvited so propagation can be observed at all', () => {
    void start(minPeerAcks + witnessPeers + 3).catch(() => undefined)

    expect(captured.session.invSentTo.size).toBe(minPeerAcks + 3)
    expect(captured.session.readyPeers().length - captured.session.invSentTo.size).toBe(witnessPeers)
  })

  it('succeeds once a witness announces the txid back', async () => {
    const result = start(minPeerAcks + witnessPeers + 3)
    const witness = captured.session.readyPeers().find(p => !captured.session.invSentTo.has(p))!

    captured.session.witnessAnnounces(witness)

    await expect(result).resolves.toMatchObject({peersPropagated: [`${witness.host}:19999`]})
  })

  // The tx is armed before the broadcast command, so the lock is reachable even
  // when the pool is too small to spare a witness.
  it('accepts an instant lock however few peers there were', async () => {
    const result = start(1)

    captured.session.instantLocked = true
    captured.session.emit('isdlock', {getPayload: () => new Uint8Array([0xaa])})

    await expect(result).resolves.toMatchObject({instantLocked: true, islockHex: 'aa'})
  })

  // Carrying the tx wins over observing it: below this the pool cannot do both.
  it('spares no witness when the pool can barely carry the tx', async () => {
    const settled = expect(start(minPeerAcks)).rejects.toThrow(/no peer to spare as a propagation witness/)
    captured.session.deliverToInvited()

    expect(captured.session.invSentTo.size).toBe(minPeerAcks)

    await vi.advanceTimersByTimeAsync(timeoutMs)

    await settled
  })
})
