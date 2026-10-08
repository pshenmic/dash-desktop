import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import type {DapiUrlStatus, Network, PeerMode} from '../../src/renderer/src/api/types'
import type {UsePlatformNodeSettingsResult} from '../../src/renderer/src/types/connection'
import {PEER_POLL_INTERVAL_MS} from '../../src/renderer/src/constants/connection'

const harness = vi.hoisted(() => ({
  network: 'testnet' as Network | null,
  mode: 'dynamic' as PeerMode,
  nodes: {mainnet: [] as string[], testnet: [] as string[]},
  getPreferences: vi.fn(),
  getDapiUrls: vi.fn(),
  getActiveDapiUrls: vi.fn(),
  setDapiMode: vi.fn(),
  setDapiUrls: vi.fn(),
  index: 0,
  states: [] as unknown[],
  refs: [] as Array<{current: unknown}>,
  callbacks: [] as Array<{deps: unknown[]; value: unknown}>,
  effects: [] as Array<{deps: unknown[]; cleanup?: () => void}>,
  pendingLayouts: [] as Array<() => void>,
  pendingEffects: [] as Array<() => void>,
}))

vi.mock('react', () => {
  const registerEffect = (
    effect: () => void | (() => void),
    deps: unknown[],
    pending: Array<() => void>,
  ): void => {
    const index = harness.index++
    const previous = harness.effects[index]
    if (!previous || deps.some((dep, i) => !Object.is(dep, previous.deps[i]))) {
      harness.effects[index] = {deps}
      pending.push(() => {
        previous?.cleanup?.()
        harness.effects[index] = {deps, cleanup: effect() || undefined}
      })
    }
  }

  return {
    useState: <T>(initial: T) => {
      const index = harness.index++
      if (!(index in harness.states)) harness.states[index] = initial
      return [harness.states[index], (update: T | ((previous: T) => T)) => {
        harness.states[index] = typeof update === 'function'
          ? (update as (previous: T) => T)(harness.states[index] as T)
          : update
      }]
    },
    useRef: <T>(initial: T) => {
      const index = harness.index++
      if (!(index in harness.refs)) harness.refs[index] = {current: initial}
      return harness.refs[index]
    },
    useCallback: <T>(callback: T, deps: unknown[]): T => {
      const index = harness.index++
      const previous = harness.callbacks[index]
      if (!previous || deps.some((dep, i) => !Object.is(dep, previous.deps[i]))) {
        harness.callbacks[index] = {deps, value: callback}
      }
      return harness.callbacks[index].value as T
    },
    useSyncExternalStore: <T>(subscribe: (listener: () => void) => () => void, getSnapshot: () => T): T => {
      const index = harness.index++
      if (!(index in harness.effects)) {
        harness.effects[index] = {deps: [], cleanup: subscribe(() => {})}
      }
      return getSnapshot()
    },
    useLayoutEffect: (effect: () => void | (() => void), deps: unknown[]) => {
      registerEffect(effect, deps, harness.pendingLayouts)
    },
    useEffect: (effect: () => void | (() => void), deps: unknown[]) => {
      registerEffect(effect, deps, harness.pendingEffects)
    },
  }
})

vi.mock('@renderer/api', () => ({API: {
  getPreferences: harness.getPreferences,
  getDapiUrls: harness.getDapiUrls,
  getActiveDapiUrls: harness.getActiveDapiUrls,
  setDapiMode: harness.setDapiMode,
  setDapiUrls: harness.setDapiUrls,
}}))

import {usePlatformNodeSettings} from '../../src/renderer/src/hooks/usePlatformNodeSettings'

const firstUrl = 'https://10.0.0.1:1443'
const secondUrl = 'https://10.0.0.2:1443'
const addedUrl = 'https://10.0.0.3:1443'
const mainnetUrl = 'https://10.0.0.4'
const firstNode: DapiUrlStatus = {
  dapiUrl: firstUrl,
  proTxHash: 'first-pro-tx-hash',
  pingMs: 18,
  driveVersion: '2.0.0',
  blockHeight: 9007199254740993n,
  error: null,
}
const mainnetNode: DapiUrlStatus = {...firstNode, dapiUrl: mainnetUrl, blockHeight: 500n}

function preferences() {
  return {
    network: {
      mode: 'static',
      dapi: {mode: harness.mode, mainnet: [...harness.nodes.mainnet], testnet: [...harness.nodes.testnet]},
    },
  }
}

function render(): UsePlatformNodeSettingsResult {
  harness.index = 0
  return usePlatformNodeSettings(harness.network)
}

function commitEffects(): void {
  for (const effect of harness.pendingLayouts.splice(0)) effect()
  for (const effect of harness.pendingEffects.splice(0)) effect()
}

function unmount(): void {
  for (const effect of harness.effects) effect?.cleanup?.()
  harness.states = []
  harness.refs = []
  harness.callbacks = []
  harness.effects = []
  harness.pendingLayouts = []
  harness.pendingEffects = []
}

async function flushPromises(): Promise<void> {
  for (let i = 0; i < 12; i++) await Promise.resolve()
}

async function load(): Promise<UsePlatformNodeSettingsResult> {
  render()
  commitEffects()
  await flushPromises()
  return render()
}

async function reconcile(): Promise<UsePlatformNodeSettingsResult> {
  render()
  commitEffects()
  await flushPromises()
  return render()
}

beforeEach(() => {
  vi.useFakeTimers()
  harness.network = 'testnet'
  harness.mode = 'dynamic'
  harness.nodes = {mainnet: [mainnetUrl], testnet: [firstUrl, secondUrl]}
  harness.states = []
  harness.refs = []
  harness.callbacks = []
  harness.effects = []
  harness.pendingLayouts = []
  harness.pendingEffects = []
  harness.getPreferences.mockReset().mockImplementation(async () => preferences())
  harness.getDapiUrls.mockReset().mockImplementation(async (network: Network) => [...harness.nodes[network]])
  harness.getActiveDapiUrls.mockReset().mockResolvedValue([firstNode])
  harness.setDapiMode.mockReset().mockImplementation(async (mode: PeerMode) => {
    harness.mode = mode
  })
  harness.setDapiUrls.mockReset().mockImplementation(async (network: Network, nodes: string[]) => {
    harness.nodes[network] = [...nodes]
  })
})

afterEach(() => {
  unmount()
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('Platform node settings IPC and persistence', () => {
  it('loads Platform mode independently of Core mode and reads the selected network', async () => {
    expect(render()).toMatchObject({loading: true, settingsReady: false, activeNodes: [], staticNodes: []})
    commitEffects()
    await flushPromises()
    expect(render()).toMatchObject({
      configuredMode: 'dynamic',
      staticNodes: [firstUrl, secondUrl],
      hasStaticNodes: true,
      activeNodes: [firstNode],
      settingsReady: true,
      loading: false,
      activeNodesLoading: false,
      error: null,
    })
    expect(harness.getDapiUrls).toHaveBeenCalledWith('testnet')
    expect(harness.getActiveDapiUrls).toHaveBeenCalledWith('testnet')
  })

  it('recognizes static nodes on another network when the selected list is empty', async () => {
    harness.nodes.testnet = []
    const initial = await load()
    expect(initial).toMatchObject({staticNodes: [], hasStaticNodes: true, settingsReady: true})
    harness.nodes.mainnet = []
    initial.reload()
    expect(await reconcile()).toMatchObject({staticNodes: [], hasStaticNodes: false, settingsReady: true})
  })

  it('adds and removes only the intended static URL without replacing unrelated nodes', async () => {
    const initial = await load()
    expect(await initial.addStaticNode(` ${addedUrl} `)).toBe(true)
    expect(harness.setDapiUrls).toHaveBeenLastCalledWith('testnet', [firstUrl, secondUrl, addedUrl])
    const saved = await reconcile()
    expect(saved.staticNodes).toEqual([firstUrl, secondUrl, addedUrl])
    await saved.removeStaticNode(firstUrl)
    expect(harness.setDapiUrls).toHaveBeenLastCalledWith('testnet', [secondUrl, addedUrl])
    expect((await reconcile()).staticNodes).toEqual([secondUrl, addedUrl])
    expect(harness.nodes.mainnet).toEqual([mainnetUrl])
  })

  it('uses the existing global mode IPC for static and automatic modes', async () => {
    const initial = await load()
    await initial.setMode('static')
    expect(harness.setDapiMode).toHaveBeenLastCalledWith('static')
    const staticMode = await reconcile()
    expect(staticMode.configuredMode).toBe('static')
    await staticMode.setMode('dynamic')
    expect(harness.setDapiMode).toHaveBeenLastCalledWith('dynamic')
    const automatic = await reconcile()
    expect(automatic.configuredMode).toBe('dynamic')
    await automatic.setMode('dynamic')
    expect(harness.setDapiMode).toHaveBeenCalledTimes(2)
    expect(harness.setDapiUrls).not.toHaveBeenCalled()
  })

  it('keeps editing blocked until the authoritative list reload completes', async () => {
    const initial = await load()
    const reloaded = Promise.withResolvers<string[]>()
    await initial.addStaticNode(addedUrl)
    expect(render().settingsReady).toBe(false)
    harness.getDapiUrls.mockReturnValueOnce(reloaded.promise)
    render()
    commitEffects()
    await flushPromises()
    const loading = render()
    expect(loading.settingsReady).toBe(false)
    await expect(loading.addStaticNode('https://10.0.0.5:1443')).rejects.toThrow('Wait for Platform node settings')
    expect(harness.setDapiUrls).toHaveBeenCalledTimes(1)
    reloaded.resolve([firstUrl, secondUrl, addedUrl])
    await flushPromises()
    expect(render()).toMatchObject({staticNodes: [firstUrl, secondUrl, addedUrl], settingsReady: true})
  })

  it('re-reads saved settings after a mutation fails after changing backend state', async () => {
    const initial = await load()
    const authoritative = Promise.withResolvers<string[]>()
    harness.setDapiUrls.mockImplementationOnce(async (network: Network, nodes: string[]) => {
      harness.nodes[network] = nodes
      throw new Error('preference write failed')
    })
    await expect(initial.addStaticNode(addedUrl)).rejects.toThrow('preference write failed')
    expect(render().settingsReady).toBe(false)
    harness.getDapiUrls.mockReturnValueOnce(authoritative.promise)
    const recovering = await reconcile()
    expect(recovering.settingsReady).toBe(false)
    await expect(recovering.removeStaticNode(secondUrl)).rejects.toThrow('Wait for Platform node settings')
    expect(harness.setDapiUrls).toHaveBeenCalledTimes(1)
    authoritative.resolve([firstUrl, secondUrl, addedUrl])
    await flushPromises()
    const reconciled = render()
    expect(reconciled.staticNodes).toEqual([firstUrl, secondUrl, addedUrl])
    expect(reconciled.error).toContain('preference write failed')
    expect(harness.getPreferences).toHaveBeenCalledTimes(2)
    expect(harness.getDapiUrls).toHaveBeenCalledTimes(2)
  })

  it('retains saved nodes after the backend rejects a probe and allows retrying', async () => {
    const initial = await load()
    const probeError = `DAPI URL ${addedUrl} did not respond: connection refused`
    harness.setDapiUrls.mockRejectedValueOnce(new Error(probeError))
    await expect(initial.addStaticNode(addedUrl)).rejects.toThrow(probeError)
    expect(harness.nodes.testnet).toEqual([firstUrl, secondUrl])
    expect(render()).toMatchObject({staticNodes: [firstUrl, secondUrl], settingsReady: false, error: probeError})

    const recovered = await reconcile()
    expect(recovered).toMatchObject({staticNodes: [firstUrl, secondUrl], settingsReady: true, error: probeError})
    expect(await recovered.addStaticNode(addedUrl)).toBe(true)
    expect(harness.setDapiUrls).toHaveBeenNthCalledWith(2, 'testnet', [firstUrl, secondUrl, addedUrl])
    expect(await reconcile()).toMatchObject({staticNodes: [firstUrl, secondUrl, addedUrl], settingsReady: true, error: null})
  })

  it('re-reads the authoritative mode after its setter rejects', async () => {
    const initial = await load()
    harness.setDapiMode.mockImplementationOnce(async () => {
      harness.mode = 'static'
      throw new Error('mode write failed')
    })
    await expect(initial.setMode('static')).rejects.toThrow('mode write failed')
    expect(render().settingsReady).toBe(false)
    expect(await reconcile()).toMatchObject({configuredMode: 'static', error: 'mode write failed'})
  })

  it('never mutates saved nodes without a selected network', async () => {
    harness.network = null
    const initial = await load()
    expect(initial).toMatchObject({loading: false, settingsReady: false, staticNodes: [], activeNodes: []})
    await expect(initial.addStaticNode(addedUrl)).rejects.toThrow('Wait for Platform node settings')
    expect(harness.getDapiUrls).not.toHaveBeenCalled()
    expect(harness.getActiveDapiUrls).not.toHaveBeenCalled()
    expect(harness.setDapiUrls).not.toHaveBeenCalled()
  })
})

describe('Platform node settings request races', () => {
  it('preserves a slow add across remount and reloads its result before allowing the next add', async () => {
    const initial = await load()
    const write = Promise.withResolvers<void>()
    const authoritative = Promise.withResolvers<string[]>()
    const nextUrl = 'https://10.0.0.6:1443'
    harness.setDapiUrls.mockImplementationOnce(async (network: Network, nodes: string[]) => {
      await write.promise
      harness.nodes[network] = [...nodes]
    })
    const adding = initial.addStaticNode(addedUrl)
    unmount()
    const remounted = await load()
    expect(remounted).toMatchObject({settingsReady: false, pending: 'save-nodes'})
    await expect(remounted.addStaticNode(nextUrl)).rejects.toThrow()
    expect(harness.setDapiUrls).toHaveBeenCalledTimes(1)

    harness.getDapiUrls.mockReturnValueOnce(authoritative.promise)
    write.resolve()
    await adding
    const reloading = await reconcile()
    expect(reloading).toMatchObject({settingsReady: false, pending: null})
    await expect(reloading.addStaticNode(nextUrl)).rejects.toThrow('Wait for Platform node settings')
    expect(harness.setDapiUrls).toHaveBeenCalledTimes(1)
    authoritative.resolve([firstUrl, secondUrl, addedUrl])
    await flushPromises()
    const ready = render()
    expect(ready).toMatchObject({staticNodes: [firstUrl, secondUrl, addedUrl], settingsReady: true})
    await ready.addStaticNode(nextUrl)
    expect(harness.setDapiUrls).toHaveBeenLastCalledWith('testnet', [firstUrl, secondUrl, addedUrl, nextUrl])
    expect(harness.nodes.testnet).toEqual([firstUrl, secondUrl, addedUrl, nextUrl])
  })

  it('rejects a callback captured before another mount completes a mutation', async () => {
    const stale = await load()
    unmount()
    const current = await load()
    await current.addStaticNode(addedUrl)
    await expect(stale.addStaticNode('https://10.0.0.7:1443')).rejects.toThrow('Wait for Platform node settings')
    expect(harness.setDapiUrls).toHaveBeenCalledTimes(1)
    expect((await reconcile()).staticNodes).toEqual([firstUrl, secondUrl, addedUrl])
  })

  it('discards a settings read started before a mutation completed', async () => {
    const initial = await load()
    const staleNodes = Promise.withResolvers<string[]>()
    harness.getDapiUrls.mockReturnValueOnce(staleNodes.promise)
    initial.reload()
    render()
    commitEffects()
    await initial.addStaticNode(addedUrl)
    staleNodes.resolve([firstUrl, secondUrl])
    await flushPromises()
    const stale = render()
    expect(stale.settingsReady).toBe(false)
    await expect(stale.removeStaticNode(firstUrl)).rejects.toThrow('Wait for Platform node settings')
    expect(harness.setDapiUrls).toHaveBeenCalledTimes(1)
    expect(await reconcile()).toMatchObject({staticNodes: [firstUrl, secondUrl, addedUrl], settingsReady: true})
  })

  it('unlocks after a failed mutation from an unmounted view and reloads authoritative settings', async () => {
    const initial = await load()
    const write = Promise.withResolvers<void>()
    const authoritative = Promise.withResolvers<string[]>()
    harness.setDapiUrls.mockImplementationOnce(async (network: Network, nodes: string[]) => {
      await write.promise
      harness.nodes[network] = [...nodes]
      throw new Error('preference write failed')
    })
    const adding = initial.addStaticNode(addedUrl)
    const rejected = expect(adding).rejects.toThrow('preference write failed')
    unmount()
    expect(await load()).toMatchObject({settingsReady: false, pending: 'save-nodes'})
    harness.getDapiUrls.mockReturnValueOnce(authoritative.promise)
    write.resolve()
    await rejected
    const reloading = await reconcile()
    expect(reloading).toMatchObject({settingsReady: false, pending: null})
    await expect(reloading.addStaticNode('https://10.0.0.6:1443')).rejects.toThrow('Wait for Platform node settings')
    expect(harness.setDapiUrls).toHaveBeenCalledTimes(1)
    authoritative.resolve([firstUrl, secondUrl, addedUrl])
    await flushPromises()
    const ready = render()
    expect(ready).toMatchObject({staticNodes: [firstUrl, secondUrl, addedUrl], settingsReady: true})
    await ready.removeStaticNode(firstUrl)
    expect(harness.setDapiUrls).toHaveBeenLastCalledWith('testnet', [secondUrl, addedUrl])
  })

  it.each(['success', 'error'] as const)('ignores an old-pool probe %s while probing a changed mode', async outcome => {
    const oldProbe = Promise.withResolvers<DapiUrlStatus[]>()
    const currentProbe = Promise.withResolvers<DapiUrlStatus[]>()
    harness.getActiveDapiUrls.mockReturnValueOnce(oldProbe.promise).mockReturnValueOnce(currentProbe.promise)
    const initial = await load()
    const changing = initial.setMode('static')
    await flushPromises()
    expect(harness.getActiveDapiUrls).toHaveBeenCalledTimes(2)

    if (outcome === 'success') oldProbe.resolve([mainnetNode])
    else oldProbe.reject(new Error('old pool probe failed'))
    await flushPromises()
    expect(render()).toMatchObject({activeNodes: [], activeNodesError: null, activeNodesLoading: true, pending: 'set-mode'})

    currentProbe.resolve([firstNode])
    await changing
    expect(render()).toMatchObject({activeNodes: [firstNode], activeNodesError: null, activeNodesLoading: false, pending: null})
    expect(await reconcile()).toMatchObject({configuredMode: 'static', activeNodes: [firstNode], settingsReady: true})
  })

  it('discards previous-network settings and status responses', async () => {
    const oldPreferences = Promise.withResolvers<ReturnType<typeof preferences>>()
    const oldNodes = Promise.withResolvers<string[]>()
    const oldActive = Promise.withResolvers<DapiUrlStatus[]>()
    harness.getPreferences.mockReturnValueOnce(oldPreferences.promise)
    harness.getDapiUrls.mockReturnValueOnce(oldNodes.promise)
    harness.getActiveDapiUrls.mockReturnValueOnce(oldActive.promise).mockResolvedValueOnce([mainnetNode])
    render()
    commitEffects()
    harness.network = 'mainnet'
    const selected = await load()
    expect(selected).toMatchObject({staticNodes: [mainnetUrl], activeNodes: [mainnetNode], settingsReady: true})
    oldPreferences.resolve({network: {mode: 'static', dapi: {mode: 'static', mainnet: [], testnet: []}}})
    oldNodes.resolve([firstUrl])
    oldActive.resolve([firstNode])
    await flushPromises()
    expect(render()).toMatchObject({
      configuredMode: 'dynamic', staticNodes: [mainnetUrl], activeNodes: [mainnetNode], settingsReady: true,
    })
  })

  it('hides the previous list and prevents submitting it while the next network loads', async () => {
    await load()
    const nextNodes = Promise.withResolvers<string[]>()
    harness.network = 'mainnet'
    harness.getDapiUrls.mockReturnValueOnce(nextNodes.promise)
    const switching = render()
    expect(switching).toMatchObject({staticNodes: [], activeNodes: [], loading: true, settingsReady: false})
    await expect(switching.addStaticNode(addedUrl)).rejects.toThrow('Wait for Platform node settings')
    commitEffects()
    await flushPromises()
    await expect(render().addStaticNode(addedUrl)).rejects.toThrow('Wait for Platform node settings')
    expect(harness.setDapiUrls).not.toHaveBeenCalled()
    nextNodes.resolve([mainnetUrl])
    await flushPromises()
    await render().addStaticNode(addedUrl)
    expect(harness.setDapiUrls).toHaveBeenLastCalledWith('mainnet', [mainnetUrl, addedUrl])
  })

  it('does not overlap long probes or manual refreshes and waits before polling again', async () => {
    const probe = Promise.withResolvers<DapiUrlStatus[]>()
    harness.getActiveDapiUrls.mockReturnValueOnce(probe.promise)
    const initial = await load()
    expect(initial.activeNodesLoading).toBe(true)
    await vi.advanceTimersByTimeAsync(PEER_POLL_INTERVAL_MS * 3)
    initial.reload()
    await reconcile()
    expect(harness.getActiveDapiUrls).toHaveBeenCalledTimes(1)
    probe.resolve([firstNode])
    await flushPromises()
    expect(render()).toMatchObject({activeNodes: [firstNode], activeNodesLoading: false})
    await vi.advanceTimersByTimeAsync(PEER_POLL_INTERVAL_MS - 1)
    expect(harness.getActiveDapiUrls).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(harness.getActiveDapiUrls).toHaveBeenCalledTimes(2)
  })
})
