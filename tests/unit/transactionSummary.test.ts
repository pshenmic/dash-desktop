import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import React, {isValidElement, type ReactElement, type ReactNode} from 'react'
import {TransferOperation} from '../../src/renderer/src/enums/TransferOperation'
import {TX_SUMMARY_CARD_LABELS} from '../../src/renderer/src/constants/txSummary'
import type {TransactionSummaryProps} from '../../src/renderer/src/types/TransactionSummary'

const harness = vi.hoisted(() => ({index: 0, states: [] as unknown[]}))

vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useId: () => 'fee-options',
  useState: <T>(initial: T) => {
    const index = harness.index++
    if (!(index in harness.states)) harness.states[index] = initial
    return [harness.states[index], (value: T) => { harness.states[index] = value }]
  },
}))
vi.mock('@renderer/components/dash-ui-kit-extended', () => ({Button: 'button', ChevronIcon: 'svg', Text: 'span'}))
vi.mock('@renderer/components/ui/Checkbox', () => ({default: 'input'}))
vi.mock('@renderer/components/ui/CreditsAmount', () => ({default: 'credits-amount'}))
vi.mock('@renderer/components/ui/DropdownField', () => ({default: 'select'}))
vi.mock('@renderer/components/ui/Spinner', () => ({default: 'progress'}))

import TransactionSummary from '../../src/renderer/src/components/pages/transfer/TransactionSummary'

type Node = ReactElement<Record<string, unknown>>

function elements(node: ReactNode): Node[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!isValidElement<{children?: ReactNode}>(node)) return []
  return [node as Node, ...elements(node.props.children)]
}

function texts(nodes: Node[]): string[] {
  return nodes.flatMap(node => React.Children.toArray(node.props.children as ReactNode).filter((child): child is string => typeof child === 'string'))
}

function props(overrides: Partial<TransactionSummaryProps> = {}): TransactionSummaryProps {
  return {
    children: null,
    operation: TransferOperation.AddressFundsTransfer,
    isCoreOperation: false,
    amountDuffs: 100_000_000n,
    maxAmountDuffs: null,
    fee: {credits: 12_345_678n, totalDuffs: 0n, ready: true, loading: false, error: null},
    route: {recipients: [{id: 'a', address: 'tdash1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq', amount: '1'}], subtractFee: false, feeRecipientId: null},
    hasManualPlatformInputs: false,
    amountError: null,
    canSubmit: false,
    onRouteChange: vi.fn(),
    onCoinControl: vi.fn(),
    onRetryFee: vi.fn(),
    onReview: vi.fn(),
    ...overrides,
  }
}

function render(overrides: Partial<TransactionSummaryProps> = {}): Node[] {
  harness.index = 0
  return elements(TransactionSummary(props(overrides)))
}

beforeEach(() => {
  vi.stubGlobal('React', React)
  harness.states = []
})

afterEach(() => vi.unstubAllGlobals())

describe('TransactionSummary', () => {
  it('labels the summary columns as in the design', () => {
    const labels = texts(render())
    expect(labels).toContain(TX_SUMMARY_CARD_LABELS.recipientsReceive)
    expect(labels).toContain(TX_SUMMARY_CARD_LABELS.networkFee)
    expect(labels).toContain(TX_SUMMARY_CARD_LABELS.sendTotal)
  })

  it('shows every credit amount exactly, the fee included', () => {
    const amounts = render().filter(node => node.type === 'credits-amount')
    expect(amounts.map(node => node.props.credits)).toContain(12_345_678n)
    expect(amounts.every(node => node.props.exact === true)).toBe(true)
  })

  it('renders Review Transaction as a disabled Button until the send is valid', () => {
    const review = render().find(node => node.type === 'button' && node.props.children === TX_SUMMARY_CARD_LABELS.review)!
    expect(review.props.disabled).toBe(true)
    expect(review.props.colorScheme).toBe('lightBlue-mint')
  })

  it('names the fee recipient by number and keeps its full address', () => {
    harness.states[0] = true
    const route = props().route
    const select = render({route: {...route, subtractFee: true, feeRecipientId: 'a'}}).find(node => node.type === 'select')!
    const options = select.props.options as {value: string, label: string, description?: string}[]
    expect(options[1]).toEqual({value: 'a', label: 'Recipient 1', description: route.recipients[0].address})
  })
})
