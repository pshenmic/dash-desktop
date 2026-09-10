import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'

vi.mock('electron', () => ({utilityProcess: {fork: vi.fn()}}))
vi.mock('../../src/main/src/logTransport', () => ({logChildOutput: vi.fn()}))
vi.mock('fs', () => {
  const mocked = {mkdirSync: vi.fn(), promises: {rm: vi.fn().mockResolvedValue(undefined)}}
  return {...mocked, default: mocked}
})

import {WalletSyncService} from '../../src/main/src/services/core/WalletSyncService'
import {Preferences} from '../../src/main/src/preferences'

describe('reloading peer preferences', () => {
  let service: WalletSyncService
  let preferences: Preferences
  let child: {postMessage: ReturnType<typeof vi.fn>}

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    child = {
      on: () => undefined,
      postMessage: vi.fn(),
      kill: vi.fn(),
      stdout: null,
      stderr: null,
    } as never
    const {utilityProcess} = await import('electron')
    vi.mocked(utilityProcess.fork).mockReturnValue(child as never)
    preferences = Preferences.fromObject({version: 9})
    service = new WalletSyncService({} as never, {} as never, {} as never, preferences)
    await service.startLockListen('testnet')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const rebuilds = (): number =>
    child.postMessage.mock.calls.map(call => call[0]).filter(msg => msg.type === 'listen').length

  it('rebuilds nothing when the settings the child was given have not changed', async () => {
    await service.reloadPeerPreferences()

    expect(rebuilds()).toBe(1)
  })

  // Dynamic mode dials the seeds and the dynamic list; a pinned peer is not
  // among them, so the session it would cost has nothing to gain.
  it('keeps the session for a pinned peer while the mode is dynamic', async () => {
    preferences.network.testnet.staticPeers.push('1.2.3.4:19999')
    await service.reloadPeerPreferences()

    expect(rebuilds()).toBe(1)
  })

  it('keeps the session for an edit to the network it is not running', async () => {
    preferences.network.mode = 'static'
    preferences.network.testnet.staticPeers.push('1.2.3.4:19999')
    await service.reloadPeerPreferences()
    preferences.network.mainnet.staticPeers.push('5.6.7.8:9999')
    await service.reloadPeerPreferences()

    expect(rebuilds()).toBe(2)
  })

  it('rebuilds when the running network gains a peer it dials', async () => {
    preferences.network.testnet.dynamicPeers.push('1.2.3.4:19999')
    await service.reloadPeerPreferences()

    expect(rebuilds()).toBe(2)
  })

  it('rebuilds on a mode switch, which changes every list that is dialled', async () => {
    preferences.network.mode = 'static'
    await service.reloadPeerPreferences()

    expect(rebuilds()).toBe(2)
  })
})
