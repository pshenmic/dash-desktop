import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import type {Evonode, Network, PeerMode} from '../../src/renderer/src/api/types'
import type {UsePlatformNodeSettingsResult} from '../../src/renderer/src/types/connection'
import {PEER_POLL_INTERVAL_MS} from '../../src/renderer/src/constants/connection'

const harness = vi.hoisted(() => ({
  network: 'testnet' as Network | null,
  mode: 'dynamic' as PeerMode,
  nodes: {mainnet: [] as string[], testnet: [] as string[]},
  getPreferences: vi.fn(),
  getEvonodes: vi.fn(),
  getActiveEvonodes: vi.fn(),
  setGrpcPoolMode: vi.fn(),
  setEvonodes: vi.fn(),
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
  getEvonodes: harness.getEvonodes,
  getActiveEvonodes: harness.getActiveEvonodes,
  setGrpcPoolMode: harness.setGrpcPoolMode,
  setEvonodes: harness.setEvonodes,
}}))

import {usePlatformNodeSettings} from '../../src/renderer/src/hooks/usePlatformNodeSettings'

const firstUrl = 'https://first.example:1443'
const secondUrl = 'https://second.example:1443'
const addedUrl = 'https://added.example:1443'
const mainnetUrl = 'https://mainnet.example'
const firstNode: Evonode = {
  dapiUrl: firstUrl,
  proTxHash: 'first-pro-tx-hash',
  pingMs: 18,
  driveVersion: '2.0.0',
  blockHeight: 9007199254740993n,
}
const mainnetNode: Evonode = {...firstNode, dapiUrl: mainnetUrl, blockHeight: 500n}

function preferences() {
  return {
    network: {
      mode: 'static',
      evonodes: {mode: harness.mode, mainnet: [...harness.nodes.mainnet], testnet: [...harness.nodes.testnet]},
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
  harness.getEvonodes.mockReset().mockImplementation(async (network: Network) => [...harness.nodes[network]])
  harness.getActiveEvonodes.mockReset().mockResolvedValue([firstNode])
  harness.setGrpcPoolMode.mockReset().mockImplementation(async (mode: PeerMode) => {
    harness.mode = mode
  })
  harness.setEvonodes.mockReset().mockImplementation(async (network: Network, nodes: string[]) => {
    harness.nodes[network] = [...nodes]
  })
})

afterEach(() => {
  for (const effect of harness.effects) effect?.cleanup?.()
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
      activeNodes: [firstNode],
      settingsReady: true,
      loading: false,
      activeNodesLoading: false,
      error: null,
    })
    expect(harness.getEvonodes).toHaveBeenCalledWith('testnet')
    expect(harness.getActiveEvonodes).toHaveBeenCalledWith('testnet')
  })

  it('adds and removes only the intended static URL without replacing unrelated nodes', async () => {
    const initial = await load()
    expect(await initial.addStaticNode(` ${addedUrl} `)).toBe(true)
    expect(harness.setEvonodes).toHaveBeenLastCalledWith('testnet', [firstUrl, secondUrl, addedUrl])
    const saved = await reconcile()
    expect(saved.staticNodes).toEqual([firstUrl, secondUrl, addedUrl])
    await saved.removeStaticNode(firstUrl)
    expect(harness.setEvonodes).toHaveBeenLastCalledWith('testnet', [secondUrl, addedUrl])
    expect((await reconcile()).staticNodes).toEqual([secondUrl, addedUrl])
    expect(harness.nodes.mainnet).toEqual([mainnetUrl])
  })

  it('uses the existing global mode IPC for static and automatic modes', async () => {
    const initial = await load()
    await initial.setMode('static')
    expect(harness.setGrpcPoolMode).toHaveBeenLastCalledWith('static')
    const staticMode = await reconcile()
    expect(staticMode.configuredMode).toBe('static')
    await staticMode.setMode('dynamic')
    expect(harness.setGrpcPoolMode).toHaveBeenLastCalledWith('dynamic')
    const automatic = await reconcile()
    expect(automatic.configuredMode).toBe('dynamic')
    await automatic.setMode('dynamic')
    expect(harness.setGrpcPoolMode).toHaveBeenCalledTimes(2)
    expect(harness.setEvonodes).not.toHaveBeenCalled()
  })

  it('keeps editing blocked until the authoritative list reload completes', async () => {
    const initial = await load()
    const reloaded = Promise.withResolvers<string[]>()
    await initial.addStaticNode(addedUrl)
    expect(render().settingsReady).toBe(false)
    harness.getEvonodes.mockReturnValueOnce(reloaded.promise)
    render()
    commitEffects()
    await flushPromises()
    const loading = render()
    expect(loading.settingsReady).toBe(false)
    await expect(loading.addStaticNode('https://another.example:1443')).rejects.toThrow('Wait for Platform node settings')
    expect(harness.setEvonodes).toHaveBeenCalledTimes(1)
    reloaded.resolve([firstUrl, secondUrl, addedUrl])
    await flushPromises()
    expect(render()).toMatchObject({staticNodes: [firstUrl, secondUrl, addedUrl], settingsReady: true})
  })

  it('re-reads saved settings after a mutation fails after changing backend state', async () => {
    const initial = await load()
    const authoritative = Promise.withResolvers<string[]>()
    harness.setEvonodes.mockImplementationOnce(async (network: Network, nodes: string[]) => {
      harness.nodes[network] = nodes
      throw new Error('preference write failed')
    })
    await expect(initial.addStaticNode(addedUrl)).rejects.toThrow('preference write failed')
    expect(render().settingsReady).toBe(false)
    harness.getEvonodes.mockReturnValueOnce(authoritative.promise)
    const recovering = await reconcile()
    expect(recovering.settingsReady).toBe(false)
    await expect(recovering.removeStaticNode(secondUrl)).rejects.toThrow('Wait for Platform node settings')
    expect(harness.setEvonodes).toHaveBeenCalledTimes(1)
    authoritative.resolve([firstUrl, secondUrl, addedUrl])
    await flushPromises()
    const reconciled = render()
    expect(reconciled.staticNodes).toEqual([firstUrl, secondUrl, addedUrl])
    expect(reconciled.error).toContain('preference write failed')
    expect(harness.getPreferences).toHaveBeenCalledTimes(2)
    expect(harness.getEvonodes).toHaveBeenCalledTimes(2)
  })

  it('re-reads the authoritative mode after its setter rejects', async () => {
    const initial = await load()
    harness.setGrpcPoolMode.mockImplementationOnce(async () => {
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
    expect(harness.getEvonodes).not.toHaveBeenCalled()
    expect(harness.getActiveEvonodes).not.toHaveBeenCalled()
    expect(harness.setEvonodes).not.toHaveBeenCalled()
  })
})

describe('Platform node settings request races', () => {
  it('discards previous-network settings and status responses', async () => {
    const oldPreferences = Promise.withResolvers<ReturnType<typeof preferences>>()
    const oldNodes = Promise.withResolvers<string[]>()
    const oldActive = Promise.withResolvers<Evonode[]>()
    harness.getPreferences.mockReturnValueOnce(oldPreferences.promise)
    harness.getEvonodes.mockReturnValueOnce(oldNodes.promise)
    harness.getActiveEvonodes.mockReturnValueOnce(oldActive.promise).mockResolvedValueOnce([mainnetNode])
    render()
    commitEffects()
    harness.network = 'mainnet'
    const selected = await load()
    expect(selected).toMatchObject({staticNodes: [mainnetUrl], activeNodes: [mainnetNode], settingsReady: true})
    oldPreferences.resolve({network: {mode: 'static', evonodes: {mode: 'static', mainnet: [], testnet: []}}})
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
    harness.getEvonodes.mockReturnValueOnce(nextNodes.promise)
    const switching = render()
    expect(switching).toMatchObject({staticNodes: [], activeNodes: [], loading: true, settingsReady: false})
    await expect(switching.addStaticNode(addedUrl)).rejects.toThrow('Wait for Platform node settings')
    commitEffects()
    await flushPromises()
    await expect(render().addStaticNode(addedUrl)).rejects.toThrow('Wait for Platform node settings')
    expect(harness.setEvonodes).not.toHaveBeenCalled()
    nextNodes.resolve([mainnetUrl])
    await flushPromises()
    await render().addStaticNode(addedUrl)
    expect(harness.setEvonodes).toHaveBeenLastCalledWith('mainnet', [mainnetUrl, addedUrl])
  })

  it('does not overlap long probes or manual refreshes and waits before polling again', async () => {
    const probe = Promise.withResolvers<Evonode[]>()
    harness.getActiveEvonodes.mockReturnValueOnce(probe.promise)
    const initial = await load()
    expect(initial.activeNodesLoading).toBe(true)
    await vi.advanceTimersByTimeAsync(PEER_POLL_INTERVAL_MS * 3)
    initial.reload()
    await reconcile()
    expect(harness.getActiveEvonodes).toHaveBeenCalledTimes(1)
    probe.resolve([firstNode])
    await flushPromises()
    expect(render()).toMatchObject({activeNodes: [firstNode], activeNodesLoading: false})
    await vi.advanceTimersByTimeAsync(PEER_POLL_INTERVAL_MS - 1)
    expect(harness.getActiveEvonodes).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(harness.getActiveEvonodes).toHaveBeenCalledTimes(2)
  })
})
