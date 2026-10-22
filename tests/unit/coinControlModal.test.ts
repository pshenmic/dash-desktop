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
vi.mock('dash-ui-kit/react', () => ({DashLogo: 'svg', useTheme: () => ({theme: 'light'})}))
vi.mock('@renderer/contexts/ConnectionModeContext', () => ({useConnectionModeContext: () => ({showSyncWarning: true})}))
vi.mock('@renderer/hooks/useFiat', () => ({useFiat: () => ({rateReady: false, format: () => '$0.00'})}))
vi.mock('@renderer/components/dash-ui-kit-enxtended', () => ({Button: 'button', ArrowIcon: 'svg', CreditsIcon: 'svg', CrossIcon: 'svg', HighlightedIdentifier: 'span', ShieldSmallIcon: 'svg', Text: 'span'}))
vi.mock('@renderer/components/dash-ui-kit-enxtended/icons', () => ({QrCodeIcon: 'svg', RefreshIcon: 'svg'}))
vi.mock('@renderer/components/modal/AddressQrModal', () => ({default: 'dialog'}))
vi.mock('@renderer/components/ui/Checkbox', () => ({default: 'input'}))
vi.mock('@renderer/components/ui/CopyButton', () => ({default: 'button'}))
vi.mock('@renderer/components/ui/CreditsAmount', () => ({default: 'span'}))
vi.mock('@renderer/components/pages/transfer/CoinControlAmountInput', () => ({default: 'input'}))

import CoinControlModal from '../../src/renderer/src/components/pages/transfer/CoinControlModal'
import Spinner from '../../src/renderer/src/components/ui/Spinner'

function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!isValidElement<{children?: ReactNode, below?: ReactNode}>(node)) return []
  return [node, ...elements(node.props.children), ...elements(node.props.below)]
}

function applyButton(nodes: ReactElement<Record<string, unknown>>[]): ReactElement<Record<string, unknown>> {
  return nodes.find(node => node.type === 'button' && React.Children.toArray(node.props.children as ReactNode).includes('Apply'))!
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

function platformModalProps(operation = TransferOperation.Shield): CoinControlModalProps {
  return {
    ...modalProps(), operation, selection: {kind: 'automatic'},
    platformAddresses: [
      {platformAddress: 'platform-a', balanceCredits: 500_000_000n, nonce: 0},
      {platformAddress: 'platform-b', balanceCredits: 700_000_000n, nonce: 0},
    ],
  }
}

describe('Platform coin control', () => {
  beforeEach(() => {
    harness.states = []
    vi.stubGlobal('document', {body: {}})
    vi.stubGlobal('React', React)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('selects multiple whole address balances for Shield without offering amount caps or a fee payer', () => {
    const props = platformModalProps()
    const manual = render(props).find(node => node.type === 'button'
      && elements(node).some(child => child.props.children === 'Manual'))!
    ;(manual.props.onClick as () => void)()

    const first = render(props).find(node => node.key === 'platform-a')!
    ;(first.props.onChange as (checked: boolean) => void)(true)
    const second = render(props).find(node => node.key === 'platform-b')!
    ;(second.props.onChange as (checked: boolean) => void)(true)

    const selected = render(props)
    expect(selected.find(node => node.key === 'platform-a')!.props.checked).toBe(true)
    expect(selected.find(node => node.key === 'platform-b')!.props.checked).toBe(true)
    expect(selected.some(node => node.props.role === 'radio')).toBe(false)
    expect(selected.some(node => node.props.role === 'radiogroup')).toBe(false)
    expect(selected.some(node => String(node.props.id).startsWith('coin-control-amount-'))).toBe(false)
    expect(selected.some(node => typeof node.props.children === 'string'
      && node.props.children.includes('The wallet selects the amounts and fee-paying address.'))).toBe(true)

    const apply = applyButton(selected)
    expect(apply.props.disabled).toBe(false)
    ;(apply.props.onClick as () => void)()
    expect(props.onApply).toHaveBeenCalledWith({
      kind: 'platformInputs',
      inputs: [{address: 'platform-a', credits: 500_000_000n}, {address: 'platform-b', credits: 700_000_000n}],
      feeAddress: 'platform-a',
    })
  })

  it('displays full Shield balances while preserving saved caps when applying an unchanged selection', () => {
    const props = platformModalProps()
    props.selection = {
      kind: 'platformInputs', inputs: [{address: 'platform-a', credits: 1_000_000n}], feeAddress: 'platform-a',
    }
    const nodes = render(props)
    expect(nodes.some(node => node.props.credits === 500_000_000n)).toBe(true)
    expect(nodes.some(node => node.props.id === 'coin-control-amount-platform-a')).toBe(false)
    const apply = applyButton(nodes)
    expect(apply.props.disabled).toBe(false)
    ;(apply.props.onClick as () => void)()
    expect(props.onApply).toHaveBeenCalledWith(props.selection)
    expect(props.selection.inputs[0].credits).toBe(1_000_000n)

    props.onApply = vi.fn()
    const second = render(props).find(node => node.key === 'platform-b')!
    ;(second.props.onChange as (checked: boolean) => void)(true)
    const edited = render(props)
    ;(applyButton(edited).props.onClick as () => void)()
    expect(props.onApply).toHaveBeenCalledWith({
      kind: 'platformInputs',
      inputs: [{address: 'platform-a', credits: 500_000_000n}, {address: 'platform-b', credits: 700_000_000n}],
      feeAddress: 'platform-a',
    })
  })

  it('keeps manual amount caps and fee payer controls on other Platform routes', () => {
    const props = platformModalProps(TransferOperation.AddressFundsTransfer)
    props.selection = {
      kind: 'platformInputs', inputs: [{address: 'platform-a', credits: 1_000_000n}], feeAddress: 'platform-a',
    }
    const nodes = render(props)
    expect(nodes.find(node => node.props.id === 'coin-control-amount-platform-a')!.props.credits).toBe(1_000_000n)
    expect(nodes.find(node => node.props.role === 'radio')!.props['aria-checked']).toBe(true)
    ;(applyButton(nodes).props.onClick as () => void)()
    expect(props.onApply).toHaveBeenCalledWith(props.selection)
  })

  it('moves the fee payer with single-choice chips instead of native radios', () => {
    const props = platformModalProps(TransferOperation.AddressFundsTransfer)
    props.selection = {
      kind: 'platformInputs',
      inputs: [{address: 'platform-a', credits: 1_000_000n}, {address: 'platform-b', credits: 2_000_000n}],
      feeAddress: 'platform-a',
    }
    const nodes = render(props)
    expect(nodes.some(node => node.props.type === 'radio')).toBe(false)
    expect(nodes.some(node => node.props.role === 'radiogroup')).toBe(true)
    const chips = nodes.filter(node => node.props.role === 'radio')
    expect(chips.map(chip => chip.props['aria-checked'])).toEqual([true, false])
    ;(chips[1].props.onClick as () => void)()

    const moved = render(props)
    expect(moved.filter(node => node.props.role === 'radio').map(chip => chip.props['aria-checked'])).toEqual([false, true])
    ;(applyButton(moved).props.onClick as () => void)()
    expect(props.onApply).toHaveBeenCalledWith({...props.selection, feeAddress: 'platform-b'})
  })

  it('names each fee chip after its input and moves the fee payer with arrow keys', () => {
    const focus = vi.fn()
    const getElementById = vi.fn(() => ({focus}))
    vi.stubGlobal('document', {body: {}, getElementById})
    const props = platformModalProps(TransferOperation.AddressFundsTransfer)
    props.selection = {
      kind: 'platformInputs',
      inputs: [{address: 'platform-a', credits: 1_000_000n}, {address: 'platform-b', credits: 2_000_000n}],
      feeAddress: 'platform-a',
    }
    const nodes = render(props)
    const group = nodes.find(node => node.props.role === 'radiogroup')!
    expect(elements(group.props.children as ReactNode).some(node => typeof node.props.children === 'string'
      && node.props.children.startsWith('Up to'))).toBe(false)
    const chips = nodes.filter(node => node.props.role === 'radio')
    expect(chips.map(chip => chip.props['aria-label'])).toEqual(['Pays fee: platform-a', 'Pays fee: platform-b'])
    expect(chips.map(chip => chip.props.tabIndex)).toEqual([0, -1])

    const preventDefault = vi.fn()
    ;(chips[0].props.onKeyDown as (event: {key: string, preventDefault: () => void}) => void)({key: 'ArrowDown', preventDefault})
    expect(preventDefault).toHaveBeenCalledOnce()
    expect(getElementById).toHaveBeenCalledWith('coin-control-fee-platform-b')
    expect(focus).toHaveBeenCalledOnce()

    const moved = render(props).filter(node => node.props.role === 'radio')
    expect(moved.map(chip => chip.props['aria-checked'])).toEqual([false, true])
    expect(moved.map(chip => chip.props.tabIndex)).toEqual([-1, 0])
  })

  it('shows the design copy and only the current source addresses on the Automatic tab', () => {
    const nodes = render(platformModalProps(TransferOperation.AddressFundsTransfer))
    expect(nodes.find(node => Array.isArray(node.props.addresses))!.props.addresses).toEqual(['platform-a', 'platform-b'])
    expect(nodes.some(node => node.props.children === 'Let The Wallet Choose')).toBe(true)
    expect(nodes.some(node => node.props.children === 'The wallet will select enough available inputs for the amount and fee')).toBe(true)
    const manual = nodes.find(node => node.type === 'button' && node.props.children === 'Switch to Manual')!
    expect(manual.props.size).toBe('compact')
    expect(manual.props.className).toContain('normal-case')
  })

  it('capitalises the selected unit in the counter', () => {
    const props = platformModalProps(TransferOperation.AddressFundsTransfer)
    props.selection = {
      kind: 'platformInputs', inputs: [{address: 'platform-a', credits: 1_000_000n}], feeAddress: 'platform-a',
    }
    expect(render(props).find(node => node.props.className === 'capitalize')!.props.children).toBe('input')
  })
})

describe('coin control UTXO refresh', () => {
  beforeEach(() => {
    harness.states = []
    vi.stubGlobal('document', {body: {}})
    vi.stubGlobal('React', React)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('keeps selected and unselected inputs visible by default', () => {
    const props = modalProps()
    const nodes = render({...props, utxos: [...props.utxos, {...props.utxos[0], txid: 'unselected'}]})
    expect(nodes.find(node => node.key === 'coin:0')!.props.checked).toBe(true)
    expect(nodes.find(node => node.key === 'unselected:0')!.props.checked).toBe(false)
    expect(nodes.some(node => isValidElement<{children?: ReactNode}>(node.props.label)
      && node.props.label.props.children === 'Only selected')).toBe(false)
    expect(nodes.some(node => isValidElement<{children?: ReactNode}>(node.props.label)
      && node.props.label.props.children === 'Filter Dust')).toBe(true)
  })

  it('filters dust by default without hiding dust that is already selected', () => {
    const props = modalProps()
    const coin = {...props.utxos[0], satoshis: 50_000n}
    const utxos = [coin, {...coin, txid: 'dust'}, {...coin, txid: 'large', satoshis: 200_000n}]
    const nodes = render({...props, utxos})
    const filter = nodes.find(node => isValidElement<{children?: ReactNode}>(node.props.label)
      && node.props.label.props.children === 'Filter Dust')!
    expect(filter.props.checked).toBe(true)
    expect(nodes.find(node => node.key === 'coin:0')!.props.checked).toBe(true)
    expect(nodes.some(node => node.key === 'dust:0')).toBe(false)
    expect(nodes.some(node => node.key === 'large:0')).toBe(true)

    ;(filter.props.onChange as (checked: boolean) => void)(false)
    const unfiltered = render({...props, utxos})
    expect(unfiltered.some(node => node.key === 'dust:0')).toBe(true)
    expect(unfiltered.find(node => node.key === 'coin:0')!.props.checked).toBe(true)
  })

  it('keeps a selected dust row visible after it is unchecked with the filter on', () => {
    const props = modalProps()
    const utxos = [{...props.utxos[0], satoshis: 50_000n}, {...props.utxos[0], txid: 'dust', satoshis: 50_000n}]
    const row = render({...props, utxos}).find(node => node.key === 'coin:0')!
    ;(row.props.onChange as (checked: boolean) => void)(false)

    const unchecked = render({...props, utxos})
    expect(unchecked.find(node => node.key === 'coin:0')!.props.checked).toBe(false)
    expect(unchecked.some(node => node.key === 'dust:0')).toBe(false)

    ;(unchecked.find(node => node.key === 'coin:0')!.props.onChange as (checked: boolean) => void)(true)
    expect(render({...props, utxos}).find(node => node.key === 'coin:0')!.props.checked).toBe(true)

    const filter = (nodes: ReturnType<typeof render>): ReturnType<typeof render>[number] => nodes.find(node => isValidElement<{children?: ReactNode}>(node.props.label)
      && node.props.label.props.children === 'Filter Dust')!
    ;(filter(render({...props, utxos})).props.onChange as (checked: boolean) => void)(false)
    ;(render({...props, utxos}).find(node => node.key === 'dust:0')!.props.onChange as (checked: boolean) => void)(true)
    ;(filter(render({...props, utxos})).props.onChange as (checked: boolean) => void)(true)
    ;(render({...props, utxos}).find(node => node.key === 'dust:0')!.props.onChange as (checked: boolean) => void)(false)
    expect(render({...props, utxos}).find(node => node.key === 'dust:0')!.props.checked).toBe(false)
  })

  it('updates the timestamp on an existing selected row when a pending coin confirms', () => {
    const props = modalProps()
    const pending = {...props.utxos[0], height: 0, confirmations: 0, timestamp: new Date(2026, 8, 11, 9, 15)}
    const initialRow = render({...props, utxos: [pending]}).find(node => node.key === 'coin:0')!
    expect(elements(initialRow).some(node => node.props.label === '11 Sept 2026, 09:15')).toBe(true)
    const confirmed = {...pending, height: 10, confirmations: 1, timestamp: new Date(2026, 8, 11, 9, 20)}
    const updatedRow = render({...props, utxos: [confirmed]}).find(node => node.key === 'coin:0')!
    expect(updatedRow.type).toBe(initialRow.type)
    expect(updatedRow.props.checked).toBe(true)
    expect(elements(updatedRow).some(node => node.props.label === '11 Sept 2026, 09:20')).toBe(true)
  })

  it('shows an unknown timestamp when the source cannot date a coin', () => {
    expect(render(modalProps()).some(node => node.props.label === 'Unknown')).toBe(true)
  })

  it('moves the full outpoint into the row tooltip and dates the row beside the amount', () => {
    const nodes = render(modalProps())
    const row = nodes.find(node => node.key === 'coin:0')!
    expect(row.props.title).toBe('coin:0')
    const details = elements(row).find(node => node.props.address === 'address')!
    expect(details.props.label).toBe('Unknown')
    expect(nodes.some(node => node.props.children === 'coin:0')).toBe(false)
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
    const updating = pending.find(node => node.type === 'button' && React.Children.toArray(node.props.children as ReactNode).includes('Apply'))!
    expect(updating.props.disabled).toBe(true)
    ;(updating.props.onClick as () => void)()
    expect(props.onApply).not.toHaveBeenCalled()

    const refreshed = render({...props, utxos: [...props.utxos, {...props.utxos[0], txid: 'new-coin'}]})
    expect(refreshed.find(node => node.key === 'coin:0')!.props.checked).toBe(true)
    expect(refreshed.some(node => node.key === 'new-coin:0')).toBe(true)
    const apply = refreshed.find(node => node.type === 'button' && React.Children.toArray(node.props.children as ReactNode).includes('Apply'))!
    expect(apply.props.disabled).toBe(false)
    ;(apply.props.onClick as () => void)()
    expect(props.onApply).toHaveBeenCalledWith(props.selection)
  })

  it('keeps the previous inventory on refresh failure and allows retry without applying stale data', () => {
    const props = modalProps()
    render(props)
    const failed = render({...props, utxosError: 'Could not load spendable UTXOs.'})
    expect(failed.find(node => node.key === 'coin:0')!.props.checked).toBe(true)
    expect(failed.find(node => node.type === 'button' && React.Children.toArray(node.props.children as ReactNode).includes('Apply'))!.props.disabled).toBe(true)
    const retry = failed.find(node => node.type === 'button' && node.props['aria-label'] === 'Retry loading funds')!
    ;(retry.props.onClick as () => void)()
    expect(props.onRetryUtxos).toHaveBeenCalledOnce()
  })

  it('allows a local selection while paused and identifies the saved snapshot without an updating spinner', () => {
    const props = {...modalProps(), utxosLocalSnapshot: true, coreSyncIncomplete: true}
    const nodes = render(props)
    expect(nodes.some(node => node.key === 'coin:0')).toBe(true)
    expect(nodes.some(node => typeof node.props.children === 'string' && node.props.children.startsWith('P2P sync is paused.'))).toBe(true)
    expect(nodes.some(node => node.props['aria-busy'] === true)).toBe(false)
    const apply = nodes.find(node => node.type === 'button' && React.Children.toArray(node.props.children as ReactNode).includes('Apply'))!
    expect(apply.props.disabled).toBe(false)
    ;(apply.props.onClick as () => void)()
    expect(props.onApply).toHaveBeenCalledWith(props.selection)
  })

  it('reports an empty saved snapshot while paused after loading finishes', () => {
    const props = {...modalProps(), utxos: [], utxosLocalSnapshot: true, coreSyncIncomplete: true}
    expect(render({...props, utxosLoading: true}).some(node => node.type === Spinner)).toBe(true)
    expect(render(props).some(node => node.props.text === 'No spendable UTXOs')).toBe(true)
  })

  it('replaces spent rows after refresh and refuses the now-invalid selection', () => {
    const props = modalProps()
    render(props)
    const refreshed = render({...props, utxos: [{...props.utxos[0], txid: 'replacement'}]})
    expect(refreshed.some(node => node.key === 'coin:0')).toBe(false)
    expect(refreshed.some(node => node.key === 'replacement:0')).toBe(true)
    expect(refreshed.find(node => node.type === 'button' && React.Children.toArray(node.props.children as ReactNode).includes('Apply'))!.props.disabled).toBe(true)
  })

  it('shows initial loading and reports an empty inventory only after a successful response', () => {
    const props = {...modalProps(), utxos: []}
    const pending = render({...props, utxosLoading: true})
    expect(pending.some(node => node.type === Spinner)).toBe(true)
    expect(pending.some(node => node.props.text === 'No spendable UTXOs')).toBe(false)
    const failed = render({...props, utxosError: 'Could not load spendable UTXOs.'})
    expect(failed.some(node => node.props['aria-label'] === 'Retry loading funds')).toBe(true)
    expect(failed.some(node => node.props.text === 'No spendable UTXOs')).toBe(false)
    expect(render(props).some(node => node.props.text === 'No spendable UTXOs')).toBe(true)
  })
})
