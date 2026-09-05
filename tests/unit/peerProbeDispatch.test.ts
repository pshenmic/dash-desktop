import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'

vi.mock('electron', () => ({utilityProcess: {fork: vi.fn()}}))
vi.mock('../../src/main/src/logger', () => ({logChildOutput: vi.fn()}))
vi.mock('fs', () => {
  const mocked = {mkdirSync: vi.fn(), promises: {rm: vi.fn().mockResolvedValue(undefined)}}
  return {...mocked, default: mocked}
})

import {WalletSyncService} from '../../src/main/src/services/core/WalletSyncService'
import {Preferences} from '../../src/main/src/preferences'
import {PEER_PROBE_REPLY_TIMEOUT_MS} from '../../src/main/src/constants/chain'

describe('probing a peer through the utility process', () => {
  let service: WalletSyncService
  let listeners: Map<string, (...args: never[]) => void>
  let child: {postMessage: ReturnType<typeof vi.fn>}

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    listeners = new Map()
    child = {
      on: (event: string, cb: (...args: never[]) => void) => { listeners.set(event, cb) },
      postMessage: vi.fn(),
      kill: vi.fn(),
      stdout: null,
      stderr: null,
    } as never
    const {utilityProcess} = await import('electron')
    vi.mocked(utilityProcess.fork).mockReturnValue(child as never)
    service = new WalletSyncService({} as never, {} as never, {} as never, Preferences.default())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // Forking the child also posts its log level, so the probe is not call zero.
  const sentProbe = (): {requestId: string} =>
    child.postMessage.mock.calls.map(call => call[0]).find(msg => msg.type === 'probePeer')

  it('answers the caller with what the child found', async () => {
    const probe = service.probePeer('testnet', '1.2.3.4:19999')

    expect(sentProbe()).toMatchObject({
      type: 'probePeer', network: 'testnet', peer: '1.2.3.4:19999',
    })
    listeners.get('message')?.({type: 'peerProbe', requestId: sentProbe().requestId, result: {ok: true, error: null}} as never)

    await expect(probe).resolves.toEqual({ok: true, error: null})
  })

  it('drops an answer for a request it no longer tracks', () => {
    expect(() =>
      listeners.get('message')?.({type: 'peerProbe', requestId: 'gone', result: {ok: true, error: null}} as never),
    ).not.toThrow()
  })

  // A child that never answers is not evidence about the peer, so the caller
  // has to hear an error rather than an "unreachable" it would act on.
  it('rejects when the child never answers', async () => {
    const probe = service.probePeer('testnet', '1.2.3.4:19999')
    const settled = probe.catch((err: Error) => err.message)

    await vi.advanceTimersByTimeAsync(PEER_PROBE_REPLY_TIMEOUT_MS)

    await expect(settled).resolves.toMatch(/did not answer peer probe/)
  })

  it('rejects when the child exits mid-probe', async () => {
    const probe = service.probePeer('testnet', '1.2.3.4:19999')
    const settled = probe.catch((err: Error) => err.message)

    listeners.get('exit')?.(1 as never)

    await expect(settled).resolves.toMatch(/exited \(code=1\)/)
  })
})
