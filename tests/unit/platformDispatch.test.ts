import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'

vi.mock('electron', () => ({utilityProcess: {fork: vi.fn()}}))
vi.mock('../../src/main/src/logger', () => ({logChildOutput: vi.fn()}))

import {PlatformService} from '../../src/main/platform/PlatformService'
import {SdkSource} from '../../src/main/platform/types/sdk'
import {PlatformEvent, PlatformRequestMessage} from '../../src/main/platform/types/messages'
import {PlatformWorkerService} from '../../src/main/src/services/PlatformWorkerService'

const flush = async (): Promise<void> => {
  await vi.advanceTimersByTimeAsync(0)
}

const hangingRegistry = (): SdkSource => ({
  get: () => ({
    identities: {
      getIdentityBalance: () => new Promise<bigint>(() => undefined),
      getIdentityNonce: async () => 0n,
    },
    shielded: {},
  }) as never,
  warmup: async () => undefined,
})

const balanceRequest = (requestId: string): PlatformRequestMessage => ({
  type: 'request',
  requestId,
  kind: 'identityBalance',
  network: 'testnet',
  payload: {identifier: 'id-1'},
})

describe('PlatformService dispatch', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('answers a cancel immediately and only once', async () => {
    const events: PlatformEvent[] = []
    const service = new PlatformService(hangingRegistry(), e => events.push(e))

    service.handle(balanceRequest('a'))
    service.handle({type: 'cancel', requestId: 'a'})
    await flush()

    const settled = events.filter(e => e.type === 'response')
    expect(settled).toHaveLength(1)
    expect(settled[0]).toMatchObject({ok: false, error: {code: 'cancelled'}})

    service.handle({type: 'cancel', requestId: 'a'})
    await vi.advanceTimersByTimeAsync(10_000)
    expect(events.filter(e => e.type === 'response')).toHaveLength(1)
  })

  it('leaves a request the SDK never answers pending', async () => {
    const events: PlatformEvent[] = []
    const service = new PlatformService(hangingRegistry(), e => events.push(e))

    service.handle(balanceRequest('a'))
    await vi.advanceTimersByTimeAsync(600_000)
    expect(events.filter(e => e.type === 'response')).toHaveLength(0)
  })

  it('rejects a duplicate requestId instead of losing the first', async () => {
    const events: PlatformEvent[] = []
    const service = new PlatformService(hangingRegistry(), e => events.push(e))

    service.handle(balanceRequest('a'))
    service.handle(balanceRequest('a'))
    await flush()

    const settled = events.filter(e => e.type === 'response')
    expect(settled).toHaveLength(1)
    expect(settled[0]).toMatchObject({ok: false, error: {code: 'internal'}})
  })
})

describe('PlatformWorkerService correlation', () => {
  let child: {
    on: (event: string, cb: (...args: never[]) => void) => void
    once: ReturnType<typeof vi.fn>
    postMessage: ReturnType<typeof vi.fn>
    kill: ReturnType<typeof vi.fn>
    stdout: null
    stderr: null
  }
  let listeners: Map<string, (...args: never[]) => void>
  let service: PlatformWorkerService

  beforeEach(async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    listeners = new Map()
    child = {
      on: (event, cb) => { listeners.set(event, cb) },
      once: vi.fn(),
      postMessage: vi.fn(),
      kill: vi.fn(),
      stdout: null,
      stderr: null,
    }
    const {utilityProcess} = await import('electron')
    vi.mocked(utilityProcess.fork).mockReturnValue(child as never)
    service = new PlatformWorkerService()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const sentRequestId = (): string => child.postMessage.mock.calls[0][0].requestId

  it('resolves the caller when the worker responds', async () => {
    const pending = service.request('identityBalance', 'testnet', {identifier: 'id-1'})
    const requestId = sentRequestId()

    listeners.get('message')?.({type: 'response', requestId, ok: true, result: {credits: 42n}} as never)
    await expect(pending).resolves.toEqual({credits: 42n})
  })

  it('drops a response for a request it no longer tracks', () => {
    expect(() =>
      listeners.get('message')?.({type: 'response', requestId: 'gone', ok: true, result: {}} as never),
    ).not.toThrow()
  })

  it('fails every pending request when the child exits', async () => {
    const first = service.request('identityBalance', 'testnet', {identifier: 'id-1'})
    const second = service.request('identityNonce', 'testnet', {identifier: 'id-2'})

    const failures = Promise.all([
      expect(first).rejects.toThrow(/exited/),
      expect(second).rejects.toThrow(/exited/),
    ])
    listeners.get('exit')?.(1 as never)
    await failures
  })

  it('forwards progress to the request that asked for it', async () => {
    const onProgress = vi.fn()
    const pending = service.request('encryptedNotes', 'testnet', {startIndex: 0, count: 10}, {onProgress})
    const requestId = sentRequestId()

    listeners.get('message')?.({type: 'progress', requestId, phase: 'fetching', fetched: 5, total: 10} as never)
    expect(onProgress).toHaveBeenCalledWith('fetching', 5, 10)

    listeners.get('message')?.({type: 'response', requestId, ok: true, result: {notes: []}} as never)
    await expect(pending).resolves.toEqual({notes: []})
  })
})