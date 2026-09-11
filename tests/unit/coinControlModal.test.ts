import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import React, {isValidElement, type ReactElement, type ReactNode} from 'react'
import type {CoinControlModalProps} from '../../src/renderer/src/types/CoinControl'
import {TransferOperation} from '../../src/renderer/src/enums/TransferOperation'

const harness = vi.hoisted(() => ({index: 0, states: [] as unknown[]}))

vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useEffect: () => {},
  useState: <T>(initial: T) => {
    const index = harness.index++
    if (!(index in harness.states)) harness.states[index] = initial
    return [harness.states[index], (value: T) => { harness.states[index] = value }]
  },
}))
vi.mock('react-dom', () => ({createPortal: (element: ReactNode) => element}))
vi.mock('dash-ui-kit/react', () => ({useTheme: () => ({theme: 'light'})}))
vi.mock('@renderer/contexts/ConnectionModeContext', () => ({useConnectionModeContext: () => ({showSyncWarning: true})}))
vi.mock('@renderer/components/dash-ui-kit-enxtended', () => ({Button: 'button', CreditsIcon: 'svg', CrossIcon: 'svg', ShieldSmallIcon: 'svg', Text: 'span'}))
vi.mock('@renderer/components/ui/Checkbox', () => ({default: 'input'}))
vi.mock('@renderer/components/ui/CopyButton', () => ({default: 'button'}))
vi.mock('@renderer/components/ui/CreditsAmount', () => ({default: 'span'}))
vi.mock('@renderer/components/pages/transfer/CoinControlAmountInput', () => ({default: 'input'}))

import CoinControlModal from '../../src/renderer/src/components/pages/transfer/CoinControlModal'

function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!isValidElement<{children?: ReactNode}>(node)) return []
  return [node, ...elements(node.props.children)]
}

function render(props: CoinControlModalProps): ReactElement<Record<string, unknown>>[] {
  harness.index = 0
  return elements(CoinControlModal(props))
}

function modalProps(): CoinControlModalProps {
  return {
    isOpen: true, operation: TransferOperation.CoreSend,
    selection: {kind: 'coreOutpoints', outpoints: ['coin:0']},
    coreAddresses: [], coreAddressesLoading: false, coreAddressesError: null,
    utxos: [{txid: 'coin', vout: 0, address: 'address', satoshis: 100_000n, height: 10, timestamp: null, confirmations: 1}],
    utxosLoading: false, utxosLocalSnapshot: false, utxosError: null, coreSyncIncomplete: false,
    platformAddresses: [], platformAddressesLoading: false, platformAddressesError: null,
    shieldedNotes: [], identityLabel: null, identityId: null, platformAddress: undefined,
    onRetryCoreAddresses: vi.fn(), onRetryPlatformAddresses: vi.fn(), onRetryUtxos: vi.fn(),
    onApply: vi.fn(), onClose: vi.fn(),
  }
}

describe('coin control UTXO refresh', () => {
  beforeEach(() => {
    harness.states = []
    vi.stubGlobal('document', {body: {}})
    vi.stubGlobal('React', React)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('updates the timestamp on an existing selected row when a pending coin confirms', () => {
    const props = modalProps()
    const pending = {...props.utxos[0], height: 0, confirmations: 0, timestamp: new Date(2026, 8, 11, 9, 15)}
    const initialRow = render({...props, utxos: [pending]}).find(node => node.key === 'coin:0')!
    expect(elements(initialRow).some(node => node.props.children === '11 Sept 2026, 09:15')).toBe(true)
    const confirmed = {...pending, height: 10, confirmations: 1, timestamp: new Date(2026, 8, 11, 9, 20)}
    const updatedRow = render({...props, utxos: [confirmed]}).find(node => node.key === 'coin:0')!
    expect(updatedRow.type).toBe(initialRow.type)
    expect(updatedRow.props.checked).toBe(true)
    expect(elements(updatedRow).some(node => node.props.children === '11 Sept 2026, 09:20')).toBe(true)
  })

  it('shows an unknown timestamp when the source cannot date a coin', () => {
    expect(render(modalProps()).some(node => node.props.children === 'Unknown')).toBe(true)
  })

  it('keeps the smaller timestamp beside the full outpoint', () => {
    const nodes = render(modalProps())
    const metadata = nodes.find(node => node.type === 'div' && React.Children.toArray(node.props.children as ReactNode)
      .some(child => isValidElement<{children?: ReactNode}>(child) && child.props.children === 'coin:0'))!
    const children = React.Children.toArray(metadata.props.children as ReactNode) as ReactElement<Record<string, unknown>>[]
    expect(children).toHaveLength(2)
    expect(children[0].props).toMatchObject({size: 10, children: 'coin:0'})
    expect(children[0].props.className).toContain('break-all')
    expect(children[1].props).toMatchObject({size: 10, children: 'Unknown'})
    expect(children[1].props.className).toContain('shrink-0')
    expect(children[1].props.className).toContain('text-right')
  })

  it.each([
    {utxosLoading: true, coreSyncIncomplete: false},
    {utxosLoading: false, coreSyncIncomplete: true},
  ])('keeps selected rows during refresh %j and blocks Apply until the response arrives', refreshing => {
    const props = modalProps()
    const initialRow = render(props).find(node => node.key === 'coin:0')!
    const pending = render({...props, ...refreshing})
    const pendingRow = pending.find(node => node.key === 'coin:0')!
    expect(pendingRow.type).toBe(initialRow.type)
    expect(pendingRow.props.checked).toBe(true)
    expect(pending.some(node => node.props['aria-busy'] === true)).toBe(true)
    expect(pending.some(node => typeof node.props.children === 'string' && node.props.children.startsWith('Wallet sync'))).toBe(false)
    const updating = pending.find(node => node.type === 'button' && node.props.children === 'Updating…')!
    expect(updating.props.disabled).toBe(true)
    ;(updating.props.onClick as () => void)()
    expect(props.onApply).not.toHaveBeenCalled()

    const refreshed = render({...props, utxos: [...props.utxos, {...props.utxos[0], txid: 'new-coin'}]})
    expect(refreshed.find(node => node.key === 'coin:0')!.props.checked).toBe(true)
    expect(refreshed.some(node => node.key === 'new-coin:0')).toBe(true)
    const apply = refreshed.find(node => node.type === 'button' && node.props.children === 'Apply')!
    expect(apply.props.disabled).toBe(false)
    ;(apply.props.onClick as () => void)()
    expect(props.onApply).toHaveBeenCalledWith(props.selection)
  })

  it('keeps the previous inventory on refresh failure and allows retry without applying stale data', () => {
    const props = modalProps()
    render(props)
    const failed = render({...props, utxosError: 'Could not load spendable UTXOs.'})
    expect(failed.find(node => node.key === 'coin:0')!.props.checked).toBe(true)
    expect(failed.find(node => node.type === 'button' && node.props.children === 'Apply')!.props.disabled).toBe(true)
    const retry = failed.find(node => node.type === 'button' && node.props.children === 'Try again')!
    ;(retry.props.onClick as () => void)()
    expect(props.onRetryUtxos).toHaveBeenCalledOnce()
  })

  it('allows a local selection while paused and identifies the saved snapshot without an updating spinner', () => {
    const props = {...modalProps(), utxosLocalSnapshot: true, coreSyncIncomplete: true}
    const nodes = render(props)
    expect(nodes.some(node => node.key === 'coin:0')).toBe(true)
    expect(nodes.some(node => typeof node.props.children === 'string' && node.props.children.startsWith('P2P sync is paused.'))).toBe(true)
    expect(nodes.some(node => node.props['aria-busy'] === true)).toBe(false)
    const apply = nodes.find(node => node.type === 'button' && node.props.children === 'Apply')!
    expect(apply.props.disabled).toBe(false)
    ;(apply.props.onClick as () => void)()
    expect(props.onApply).toHaveBeenCalledWith(props.selection)
  })

  it('reports an empty saved snapshot while paused after loading finishes', () => {
    const props = {...modalProps(), utxos: [], utxosLocalSnapshot: true, coreSyncIncomplete: true}
    expect(render({...props, utxosLoading: true}).some(node => node.props.children === 'Loading available funds…')).toBe(true)
    expect(render(props).some(node => node.props.text === 'No spendable UTXOs')).toBe(true)
  })

  it('replaces spent rows after refresh and refuses the now-invalid selection', () => {
    const props = modalProps()
    render(props)
    const refreshed = render({...props, utxos: [{...props.utxos[0], txid: 'replacement'}]})
    expect(refreshed.some(node => node.key === 'coin:0')).toBe(false)
    expect(refreshed.some(node => node.key === 'replacement:0')).toBe(true)
    expect(refreshed.find(node => node.type === 'button' && node.props.children === 'Apply')!.props.disabled).toBe(true)
  })

  it('shows initial loading and reports an empty inventory only after a successful response', () => {
    const props = {...modalProps(), utxos: []}
    const pending = render({...props, utxosLoading: true})
    expect(pending.some(node => node.props.children === 'Loading available funds…')).toBe(true)
    expect(pending.some(node => node.props.text === 'No spendable UTXOs')).toBe(false)
    const failed = render({...props, utxosError: 'Could not load spendable UTXOs.'})
    expect(failed.some(node => node.props.children === 'Try again')).toBe(true)
    expect(failed.some(node => node.props.text === 'No spendable UTXOs')).toBe(false)
    expect(render(props).some(node => node.props.text === 'No spendable UTXOs')).toBe(true)
  })
})
