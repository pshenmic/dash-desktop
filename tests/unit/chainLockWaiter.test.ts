import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'

vi.mock('electron', () => ({utilityProcess: {fork: vi.fn()}}))
vi.mock('../../src/main/src/logger', () => ({logChildOutput: vi.fn()}))
vi.mock('fs', () => {
  const mocked = {mkdirSync: vi.fn(), promises: {rm: vi.fn().mockResolvedValue(undefined)}}
  return {...mocked, default: mocked}
})

import {WalletSyncService} from '../../src/main/src/services/core/WalletSyncService'
import {Preferences} from '../../src/main/src/preferences'
import {Network} from '../../src/main/src/types/Network'
import {LOCK_WATCH_SWEEP_INTERVAL_MS} from '../../src/main/src/constants/chain'

// The p2p event handler is what the utility process drives; calling it
// directly avoids forking a real utility process.
const clsig = (service: WalletSyncService, network: Network, height: number): void => {
  ;(service as unknown as {handleP2PEvent: (e: unknown) => void})
    .handleP2PEvent({type: 'chainLocked', network, height})
}

describe('waitForChainLock', () => {
  let service: WalletSyncService

  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const transactionDAO = {markChainlockedUpTo: vi.fn().mockResolvedValue(undefined)}
    service = new WalletSyncService({} as never, {} as never, transactionDAO as never, Preferences.default())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('resolves when the pool reports a height at or above the threshold', async () => {
    const waiter = service.waitForChainLock('testnet', 1_000, 60_000)

    clsig(service, 'testnet', 1_000)

    await expect(waiter).resolves.toBe(1_000)
  })

  it('stays parked while the chain is still below the threshold', async () => {
    const waiter = service.waitForChainLock('testnet', 1_000, 60_000)
    const settled = vi.fn()
    void waiter.then(settled)

    clsig(service, 'testnet', 999)
    await vi.advanceTimersByTimeAsync(0)

    expect(settled).not.toHaveBeenCalled()
  })

  // A chainlock only moves forward, so a threshold already passed must not wait
  // out the ~2.5 minutes until the next block's clsig.
  it('resolves immediately for a height already seen', async () => {
    clsig(service, 'testnet', 5_000)

    await expect(service.waitForChainLock('testnet', 4_000, 60_000)).resolves.toBe(5_000)
  })

  it('reports the height that satisfied it, not the one asked for', async () => {
    const waiter = service.waitForChainLock('testnet', 1_000, 60_000)

    clsig(service, 'testnet', 1_050)

    await expect(waiter).resolves.toBe(1_050)
  })

  it('resolves null once the timeout passes', async () => {
    const waiter = service.waitForChainLock('testnet', 1_000, 30_000)

    await vi.advanceTimersByTimeAsync(30_000)

    await expect(waiter).resolves.toBeNull()
  })

  it('keeps waiting right up to the timeout', async () => {
    const waiter = service.waitForChainLock('testnet', 1_000, 30_000)
    const settled = vi.fn()
    void waiter.then(settled)

    await vi.advanceTimersByTimeAsync(29_999)

    expect(settled).not.toHaveBeenCalled()
  })

  // Heights are only comparable within a network: mainnet's tip would otherwise
  // satisfy every testnet waiter outright.
  it('ignores a chainlock from another network', async () => {
    const waiter = service.waitForChainLock('testnet', 1_000, 60_000)
    const settled = vi.fn()
    void waiter.then(settled)

    clsig(service, 'mainnet', 2_000_000)
    await vi.advanceTimersByTimeAsync(0)

    expect(settled).not.toHaveBeenCalled()
    expect(service.chainlockedHeight('testnet')).toBe(0)
    expect(service.chainlockedHeight('mainnet')).toBe(2_000_000)
  })

  it('wakes every waiter the height satisfies, and only those', async () => {
    const low = service.waitForChainLock('testnet', 1_000, 60_000)
    const high = service.waitForChainLock('testnet', 2_000, 60_000)
    const highSettled = vi.fn()
    void high.then(highSettled)

    clsig(service, 'testnet', 1_500)
    await vi.advanceTimersByTimeAsync(0)

    await expect(low).resolves.toBe(1_500)
    expect(highSettled).not.toHaveBeenCalled()

    clsig(service, 'testnet', 2_000)
    await expect(high).resolves.toBe(2_000)
  })

  it('does not let a stale lower clsig lower the height it reports', async () => {
    clsig(service, 'testnet', 5_000)
    clsig(service, 'testnet', 4_000)

    expect(service.chainlockedHeight('testnet')).toBe(5_000)
  })

  // A resolved waiter left in the set would be notified again on the next
  // clsig, and its timer would keep the event loop's reference alive.
  it('drops a waiter once it has fired', async () => {
    const waiter = service.waitForChainLock('testnet', 1_000, 60_000)

    clsig(service, 'testnet', 1_000)
    await waiter
    clsig(service, 'testnet', 1_001)

    const pending = (service as unknown as {chainLockWaiters: Set<unknown>}).chainLockWaiters
    expect(pending.size).toBe(0)
  })

  it('drops a waiter that timed out', async () => {
    const waiter = service.waitForChainLock('testnet', 1_000, 30_000)

    await vi.advanceTimersByTimeAsync(30_000)
    await waiter

    const pending = (service as unknown as {chainLockWaiters: Set<unknown>}).chainLockWaiters
    expect(pending.size).toBe(0)
  })

  it('still marks confirmed transactions chainlocked', () => {
    const dao = (service as unknown as {transactionDAO: {markChainlockedUpTo: ReturnType<typeof vi.fn>}}).transactionDAO

    clsig(service, 'testnet', 1_234)

    expect(dao.markChainlockedUpTo).toHaveBeenCalledWith('testnet', 1_234)
  })
})

describe('arming the watch set', () => {
  let service: WalletSyncService
  let sent: unknown[]

  beforeEach(() => {
    vi.useFakeTimers()
    const transactionDAO = {markChainlockedUpTo: vi.fn().mockResolvedValue(undefined)}
    service = new WalletSyncService({} as never, {} as never, transactionDAO as never, Preferences.default())
    sent = []
    const internals = service as unknown as {child: unknown; send: (c: unknown) => void}
    internals.child = {}
    internals.send = (command: unknown): void => { sent.push(command) }
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // A funding resumed after a restart races the lock against a child process
  // that never received its watch set, and an unarmed tx has its lock dropped.
  it('arms a txid the caller never armed', () => {
    void service.waitForInstantLock('resumed-txid', 60_000)

    expect(sent).toContainEqual({type: 'watchTxs', mode: 'add', txids: ['resumed-txid']})
  })

  it('does not re-arm a txid already armed', () => {
    service.watchForInstantLock('txid')
    sent.length = 0

    void service.waitForInstantLock('txid', 60_000)

    expect(sent).toEqual([])
  })

  // An unanswered islock does not end the funding, and emptying the watch set
  // would also shut off the worker's chainlock stream.
  it('keeps the txid armed when the islock times out', async () => {
    void service.waitForInstantLock('txid', 1_000)
    sent.length = 0

    await vi.advanceTimersByTimeAsync(1_000)

    const armed = (service as unknown as {armedLockTxids: Map<string, number>}).armedLockTxids
    expect(armed.has('txid')).toBe(true)
    expect(sent).toEqual([])
  })

  it('sweeps the watch set on an interval, with no rebroadcast loop running', async () => {
    await service.startLockListen('testnet')
    sent.length = 0

    await vi.advanceTimersByTimeAsync(LOCK_WATCH_SWEEP_INTERVAL_MS)

    expect(sent).toContainEqual({type: 'watchTxs', mode: 'replace', txids: []})
  })

  it('does not arm one whose lock already arrived', () => {
    ;(service as unknown as {instantLocks: Map<string, string>}).instantLocks.set('txid', 'aabb')

    void service.waitForInstantLock('txid', 60_000)

    expect(sent).toEqual([])
  })
})

describe('observability of the crossing into main', () => {
  let service: WalletSyncService
  let logged: string[]

  beforeEach(() => {
    vi.useFakeTimers()
    logged = []
    vi.spyOn(console, 'info').mockImplementation((msg: unknown) => { logged.push(String(msg)) })
    const transactionDAO = {markChainlockedUpTo: vi.fn().mockResolvedValue(undefined)}
    service = new WalletSyncService({} as never, {} as never, transactionDAO as never, Preferences.default())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('reports the height that woke a waiter', async () => {
    const waiter = service.waitForChainLock('testnet', 1_000, 60_000)
    clsig(service, 'testnet', 1_002)
    await waiter

    expect(logged.some(l => l.includes('chainlock h=1002 woke 1 waiter(s)'))).toBe(true)
  })

  // A clsig arrives every block forever; logging one nobody asked for would
  // bury the line that matters.
  it('says nothing when no waiter was due', () => {
    clsig(service, 'testnet', 1_000)

    expect(logged).toEqual([])
  })
})

describe('waiting for a sync phase', () => {
  let service: WalletSyncService

  beforeEach(() => {
    vi.useFakeTimers()
    const transactionDAO = {markChainlockedUpTo: vi.fn().mockResolvedValue(undefined)}
    service = new WalletSyncService({} as never, {} as never, transactionDAO as never, Preferences.default())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const wait = (phase: string, ms: number): Promise<void> =>
    (service as unknown as {waitForPhase: (p: string, m: number) => Promise<void>}).waitForPhase(phase, ms)

  const status = (phase: string): void => {
    ;(service as unknown as {handleP2PEvent: (e: unknown) => void})
      .handleP2PEvent({type: 'status', status: {...service.getStatus(), phase}})
  }

  // The assignment happens in a handler on this same event loop, so there is
  // nothing to poll for — the waiter is resolved where the write happens.
  it('resolves on the status that assigns the phase', async () => {
    status('syncing-headers')
    const settled = vi.fn()
    void wait('stopped', 3_000).then(settled)

    status('stopped')
    await vi.advanceTimersByTimeAsync(0)

    expect(settled).toHaveBeenCalled()
  })

  it('does not wake on a different phase', async () => {
    // The service starts 'stopped', so it has to leave that phase before a
    // wait for it means anything.
    status('syncing-headers')
    const settled = vi.fn()
    void wait('stopped', 3_000).then(settled)

    status('synced')
    await vi.advanceTimersByTimeAsync(0)

    expect(settled).not.toHaveBeenCalled()
  })

  it('returns immediately when already in that phase', async () => {
    await expect(wait(service.getStatus().phase, 3_000)).resolves.toBeUndefined()
  })

  // A resolved waiter left behind would be notified again on the next status,
  // and its timer would keep a reference alive past the quit.
  it('drops a waiter once it has fired', async () => {
    status('syncing-headers')
    const settled = wait('stopped', 3_000)

    status('stopped')
    await settled

    const pending = (service as unknown as {phaseWaiters: Set<unknown>}).phaseWaiters
    expect(pending.size).toBe(0)
  })

  // shutdown kills the child either way; the deadline must not hold the quit.
  it('gives up on the deadline', async () => {
    status('syncing-headers')
    const settled = vi.fn()
    void wait('stopped', 3_000).then(settled)

    await vi.advanceTimersByTimeAsync(3_000)

    expect(settled).toHaveBeenCalled()
    const pending = (service as unknown as {phaseWaiters: Set<unknown>}).phaseWaiters
    expect(pending.size).toBe(0)
  })
})
