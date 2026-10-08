import React, {isValidElement, type ReactElement, type ReactNode} from 'react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import type {UsePlatformNodeSettingsResult} from '../../src/renderer/src/types/connection'
import type {ContextMenuItem} from '../../src/renderer/src/types/ContextMenu'

const harness = vi.hoisted(() => ({
  index: 0,
  states: [] as unknown[],
  settings: {} as UsePlatformNodeSettingsResult,
  hook: vi.fn(),
  addStaticNode: vi.fn(),
  removeStaticNode: vi.fn(),
  setMode: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}))

vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useState: <T,>(initial: T) => {
    const index = harness.index++
    if (!(index in harness.states)) harness.states[index] = initial
    return [harness.states[index], (update: T | ((previous: T) => T)) => {
      harness.states[index] = typeof update === 'function'
        ? (update as (previous: T) => T)(harness.states[index] as T)
        : update
    }]
  },
  useMemo: (factory: () => unknown) => factory(),
  useEffect: () => {},
}))

vi.mock('@renderer/hooks/usePlatformNodeSettings', () => ({usePlatformNodeSettings: harness.hook}))
vi.mock('@renderer/contexts/AuthContext', () => ({useAuth: () => ({status: {network: 'testnet'}})}))
vi.mock('@renderer/components/ui/Toast', () => ({
  toast: {success: harness.success, warning: harness.warning, error: harness.error},
}))
vi.mock('@renderer/components/dash-ui-kit-enxtended', () => ({
  Button: ({children, disabled, onClick}: Record<string, unknown>) => React.createElement('button', {
    type: 'button', disabled, onClick,
  }, children as ReactNode),
  Text: ({as, children, title}: Record<string, unknown>) => React.createElement(
    typeof as === 'string' ? as : 'span', {title}, children as ReactNode,
  ),
  InfoTooltip: () => null,
  AddIcon: () => null,
  CheckmarkIcon: () => null,
  CloseIcon: () => null,
  DeleteIcon: () => null,
}))
vi.mock('@renderer/components/ui/ContextMenu', () => ({
  default: ({children, items}: Record<string, unknown>) => React.createElement(
    'mock-context-menu', {items}, children as ReactNode,
  ),
}))
vi.mock('@renderer/components/ui/DropdownField', () => ({
  default: ({ariaLabel, disabled, value, options}: Record<string, unknown>) => React.createElement('button', {
    type: 'button', 'aria-label': ariaLabel, disabled, value, options,
  }, value as string),
}))
vi.mock('@renderer/components/ui/Spinner', () => ({default: () => null}))

import PlatformTab from '../../src/renderer/src/components/pages/connectionSettings/PlatformTab'

type UiElement = ReactElement<Record<string, unknown>>

const firstUrl = 'https://first.example:1443'
const secondUrl = 'https://second.example:1443'
const addedUrl = 'https://added.example:1443'

function expand(node: ReactNode): ReactNode {
  if (Array.isArray(node)) return node.map(expand)
  if (!isValidElement<Record<string, unknown>>(node)) return node
  if (typeof node.type === 'function') {
    return expand((node.type as (props: Record<string, unknown>) => ReactNode)(node.props))
  }
  return React.cloneElement(node, {}, expand(node.props.children as ReactNode))
}

function elements(node: ReactNode): UiElement[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!isValidElement<Record<string, unknown>>(node)) return []
  return [node, ...elements(node.props.children as ReactNode)]
}

function text(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(text).join('')
  if (isValidElement<Record<string, unknown>>(node)) return text(node.props.children as ReactNode)
  return typeof node === 'string' || typeof node === 'number' ? String(node) : ''
}

function render(): ReactNode {
  harness.index = 0
  return expand(PlatformTab())
}

function button(tree: ReactNode, label: string): UiElement {
  const element = elements(tree).find(element => element.type === 'button' && text(element).trim() === label)
  if (!element) throw new Error(`Missing button: ${label}`)
  return element
}

function selectList(tree: ReactNode, label: string): void {
  const group = elements(tree).find(element => element.props['aria-label'] === 'Platform node lists')
  const selected = elements(group).find(element => element.type === 'button' && text(element).trim() === label)
  if (!selected) throw new Error(`Missing list tab: ${label}`)
  ;(selected.props.onClick as () => void)()
}

async function flushPromises(): Promise<void> {
  for (let i = 0; i < 6; i++) await Promise.resolve()
}

function openAddForm(url: string): UiElement {
  selectList(render(), 'Static')
  ;(button(render(), 'Add Node').props.onClick as () => void)()
  const input = elements(render()).find(element => element.type === 'input')!
  ;(input.props.onChange as (event: {target: {value: string}}) => void)({target: {value: url}})
  return elements(render()).find(element => element.type === 'form')!
}

beforeEach(() => {
  vi.stubGlobal('React', React)
  harness.states = []
  harness.addStaticNode.mockReset().mockResolvedValue(true)
  harness.removeStaticNode.mockReset().mockResolvedValue(undefined)
  harness.setMode.mockReset().mockResolvedValue(undefined)
  harness.success.mockReset()
  harness.warning.mockReset()
  harness.error.mockReset()
  harness.settings = {
    configuredMode: 'dynamic',
    activeNodes: [{dapiUrl: firstUrl, proTxHash: null, pingMs: 20, driveVersion: '2.0.0', blockHeight: 123n, error: null}],
    staticNodes: [firstUrl, secondUrl],
    hasStaticNodes: true,
    loading: false,
    activeNodesLoading: false,
    settingsReady: true,
    pending: null,
    error: null,
    activeNodesError: null,
    reload: vi.fn(),
    setMode: harness.setMode,
    addStaticNode: harness.addStaticNode,
    removeStaticNode: harness.removeStaticNode,
  }
  harness.hook.mockReset().mockImplementation(() => harness.settings)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Platform node list editing', () => {
  it('keeps active nodes read-only in Auto mode', () => {
    const tree = render()
    expect(text(tree)).toContain(firstUrl)
    expect(elements(tree).some(element => element.type === 'mock-context-menu')).toBe(false)
    expect(elements(tree).some(element => element.type === 'form')).toBe(false)
    expect(text(tree)).not.toContain('Add Node')
    expect(text(tree)).not.toContain('Remove Node')
    selectList(tree, 'Active')
    expect(elements(render()).some(element => element.type === 'mock-context-menu')).toBe(false)
    expect(harness.addStaticNode).not.toHaveBeenCalled()
    expect(harness.removeStaticNode).not.toHaveBeenCalled()
    expect(harness.hook).toHaveBeenCalledWith('testnet')
  })

  it('exposes a failed node probe reason in its status tooltip and accessible label', () => {
    const probeError = 'getStatus failed: connection refused'
    harness.settings = {
      ...harness.settings,
      activeNodes: [{
        dapiUrl: firstUrl,
        proTxHash: null,
        pingMs: null,
        driveVersion: null,
        blockHeight: null,
        error: probeError,
      }],
    }
    const tree = render()
    const badge = elements(tree).find(element => element.props.title === probeError)
    expect(badge).toBeDefined()
    expect(text(badge)).toBe('No response')
    const row = elements(tree).find(element => {
      const label = element.props['aria-label']
      return typeof label === 'string' && label.includes(firstUrl) && label.includes(probeError)
    })
    expect(row).toBeDefined()
  })

  it('allows Static mode when only another network has saved nodes', async () => {
    harness.settings = {...harness.settings, staticNodes: [], hasStaticNodes: true}
    const mode = elements(render()).find(element => element.props['aria-label'] === 'Use Static Platform nodes')!
    ;(mode.props.onClick as () => void)()
    await flushPromises()
    expect(harness.setMode).toHaveBeenCalledWith('static')
    expect(harness.warning).not.toHaveBeenCalled()
    expect(elements(render()).some(element => element.type === 'form')).toBe(false)
  })

  it('opens the saved-node form before enabling Static mode when both networks have no saved nodes', async () => {
    harness.settings = {...harness.settings, staticNodes: [], hasStaticNodes: false}
    const mode = elements(render()).find(element => element.props['aria-label'] === 'Use Static Platform nodes')!
    ;(mode.props.onClick as () => void)()
    await flushPromises()
    expect(harness.setMode).not.toHaveBeenCalled()
    expect(harness.warning).toHaveBeenCalledTimes(1)
    expect(elements(render()).some(element => element.type === 'form')).toBe(true)
  })

  it('offers saved-node editing only after selecting Static and dispatches the intended URLs', async () => {
    selectList(render(), 'Static')
    let tree = render()
    expect(button(tree, 'Add Node').props.disabled).toBe(false)
    const menus = elements(tree).filter(element => element.type === 'mock-context-menu')
    expect(menus).toHaveLength(2)
    const actions = menus[1].props.items as ContextMenuItem[]
    expect(actions.map(action => action.id)).toEqual(['remove-static'])
    actions[0].onSelect?.()
    await flushPromises()
    expect(harness.removeStaticNode).toHaveBeenCalledWith(secondUrl)
    ;(button(tree, 'Add Node').props.onClick as () => void)()
    tree = render()
    const input = elements(tree).find(element => element.type === 'input')!
    ;(input.props.onChange as (event: {target: {value: string}}) => void)({target: {value: ` ${addedUrl} `}})
    tree = render()
    const form = elements(tree).find(element => element.type === 'form')!
    const preventDefault = vi.fn()
    ;(form.props.onSubmit as (event: {preventDefault: () => void}) => void)({preventDefault})
    await flushPromises()
    expect(preventDefault).toHaveBeenCalled()
    expect(harness.addStaticNode).toHaveBeenCalledWith(addedUrl)
  })

  it('closes the form after adding a node successfully', async () => {
    const form = openAddForm(addedUrl)
    ;(form.props.onSubmit as (event: {preventDefault: () => void}) => void)({preventDefault: vi.fn()})
    await flushPromises()
    expect(harness.success).toHaveBeenCalledWith('Static Platform node added.')
    expect(elements(render()).some(element => element.type === 'form')).toBe(false)
    expect(harness.error).not.toHaveBeenCalled()
  })

  it('closes the form with a warning when the node is already saved', async () => {
    harness.addStaticNode.mockResolvedValue(false)
    const form = openAddForm(firstUrl)
    ;(form.props.onSubmit as (event: {preventDefault: () => void}) => void)({preventDefault: vi.fn()})
    await flushPromises()
    expect(harness.warning).toHaveBeenCalledWith('This node is already in the static list.')
    expect(elements(render()).some(element => element.type === 'form')).toBe(false)
    expect(harness.success).not.toHaveBeenCalled()
  })

  it('reports a rejected add once and preserves the entered URL for retrying', async () => {
    const failure = new Error('DAPI node did not respond')
    harness.addStaticNode.mockRejectedValueOnce(failure)
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const form = openAddForm(addedUrl)
    ;(form.props.onSubmit as (event: {preventDefault: () => void}) => void)({preventDefault: vi.fn()})
    await flushPromises()
    expect(log).toHaveBeenCalledTimes(1)
    expect(log).toHaveBeenCalledWith('add Platform node failed', failure)
    expect(harness.error).toHaveBeenCalledTimes(1)
    expect(harness.error).toHaveBeenCalledWith(failure.message)
    const tree = render()
    expect(elements(tree).some(element => element.type === 'form')).toBe(true)
    const input = elements(tree).find(element => element.type === 'input')!
    expect(input.props).toMatchObject({value: addedUrl, disabled: false})
    const confirm = elements(tree).find(element => element.props['aria-label'] === 'Confirm Platform node')!
    expect(confirm.props.disabled).toBe(false)
    expect(harness.success).not.toHaveBeenCalled()
  })

  it('reports an add failure after its view has been discarded', async () => {
    const write = Promise.withResolvers<boolean>()
    const failure = new Error('preference write failed')
    harness.addStaticNode.mockReturnValueOnce(write.promise)
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const form = openAddForm(addedUrl)
    ;(form.props.onSubmit as (event: {preventDefault: () => void}) => void)({preventDefault: vi.fn()})
    harness.states = []
    write.reject(failure)
    await flushPromises()
    expect(log).toHaveBeenCalledWith('add Platform node failed', failure)
    expect(harness.error).toHaveBeenCalledTimes(1)
    expect(harness.error).toHaveBeenCalledWith(failure.message)
    expect(harness.success).not.toHaveBeenCalled()
  })

  it('reports a mode change failure directly', async () => {
    const failure = new Error('mode write failed')
    harness.setMode.mockRejectedValueOnce(failure)
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const mode = elements(render()).find(element => element.props['aria-label'] === 'Use Static Platform nodes')!
    ;(mode.props.onClick as () => void)()
    await flushPromises()
    expect(log).toHaveBeenCalledWith('set Platform node mode failed', failure)
    expect(harness.error).toHaveBeenCalledTimes(1)
    expect(harness.error).toHaveBeenCalledWith(failure.message)
    expect(harness.success).not.toHaveBeenCalled()
  })

  it('reports a remove failure directly', async () => {
    const failure = new Error('node write failed')
    harness.removeStaticNode.mockRejectedValueOnce(failure)
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    selectList(render(), 'Static')
    const menu = elements(render()).find(element => element.type === 'mock-context-menu')!
    const actions = menu.props.items as ContextMenuItem[]
    actions[0].onSelect?.()
    await flushPromises()
    expect(log).toHaveBeenCalledWith('remove Platform node failed', failure)
    expect(harness.error).toHaveBeenCalledTimes(1)
    expect(harness.error).toHaveBeenCalledWith(failure.message)
    expect(harness.success).not.toHaveBeenCalled()
  })

  it.each([
    {label: 'settings reload', settingsReady: false, pending: null},
    {label: 'pending mutation', settingsReady: true, pending: 'save-nodes'},
  ] as const)('blocks list edits and mode changes during $label', async ({settingsReady, pending}) => {
    selectList(render(), 'Static')
    ;(button(render(), 'Add Node').props.onClick as () => void)()
    harness.settings = {...harness.settings, settingsReady, pending}
    const tree = render()
    expect(button(tree, 'Add Node').props.disabled).toBe(true)
    expect(elements(tree).some(element => element.type === 'mock-context-menu')).toBe(false)
    const modeGroup = elements(tree).find(element => element.props['aria-label'] === 'Platform node selection mode')
    const modes = elements(modeGroup).filter(element => element.type === 'button')
    expect(modes.every(element => element.props.disabled === true)).toBe(true)
    const staticMode = modes.find(element => element.props['aria-label'] === 'Use Static Platform nodes')!
    ;(staticMode.props.onClick as () => void)()
    const input = elements(tree).find(element => element.type === 'input')!
    expect(input.props.disabled).toBe(true)
    ;(input.props.onChange as (event: {target: {value: string}}) => void)({target: {value: addedUrl}})
    const form = elements(render()).find(element => element.type === 'form')!
    ;(form.props.onSubmit as (event: {preventDefault: () => void}) => void)({preventDefault: vi.fn()})
    await flushPromises()
    expect(harness.addStaticNode).not.toHaveBeenCalled()
    expect(harness.removeStaticNode).not.toHaveBeenCalled()
    expect(harness.setMode).not.toHaveBeenCalled()
  })

  it('keeps the explorer fixed and node modes available without unsupported switches', () => {
    const tree = render()
    expect(elements(tree).some(element => element.props.role === 'switch')).toBe(false)
    const explorer = elements(tree).find(element => element.props['aria-label'] === 'Platform explorer connection')!
    expect(explorer.props).toMatchObject({
      value: 'platform-explorer.pshenmic.dev',
      options: [{value: 'platform-explorer.pshenmic.dev', label: 'platform-explorer.pshenmic.dev'}],
    })
    const explorerGroup = elements(tree).find(element => element.type === 'fieldset'
      && elements(element).includes(explorer))
    expect(explorerGroup?.props.disabled).toBe(true)
    expect(text(tree)).not.toContain('Enable GRPC')
    expect(text(tree)).not.toContain('Enable Platform Explorer API')
    const modeGroup = elements(tree).find(element => element.props['aria-label'] === 'Platform node selection mode')
    const modes = elements(modeGroup).filter(element => element.type === 'button')
    expect(modes.map(element => text(element))).toEqual(['Auto', 'Static'])
    expect(modes.every(element => element.props.disabled === false)).toBe(true)
    expect(harness.setMode).not.toHaveBeenCalled()
  })
})
