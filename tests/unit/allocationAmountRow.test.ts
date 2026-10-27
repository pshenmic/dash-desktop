import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import React, {isValidElement, type ReactElement, type ReactNode} from 'react'
import type {AllocationAmountRowProps} from '../../src/renderer/src/types/AllocationAmountRow'

const fiat = vi.hoisted(() => ({rateReady: true}))

vi.mock('dash-ui-kit/react', () => ({DashLogo: 'svg'}))
vi.mock('@renderer/components/dash-ui-kit-extended/tooltip', () => ({Tooltip: 'span'}))
vi.mock('@renderer/hooks/useFiat', () => ({
  useFiat: () => ({rateReady: fiat.rateReady, currency: 'usd', format: (duffs: bigint) => `$${(Number(duffs) / 1e8 * 30).toFixed(2)}`}),
}))

import AllocationAmountRow from '../../src/renderer/src/components/ui/AllocationAmountRow'

type Node = ReactElement<Record<string, unknown>>

function elements(node: ReactNode): Node[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!isValidElement<{children?: ReactNode}>(node)) return []
  return [node as Node, ...elements(node.props.children)]
}

function text(node: Node): string {
  const children = node.props.children
  return typeof children === 'string' ? children : ''
}

function props(overrides: Partial<AllocationAmountRowProps> = {}): AllocationAmountRowProps {
  return {value: '', onChange: vi.fn(), fiatDuffs: 0n, ariaLabel: 'Amount', ...overrides}
}

beforeEach(() => {
  vi.stubGlobal('React', React)
  fiat.rateReady = true
})

afterEach(() => vi.unstubAllGlobals())

const slider = {
  percent: 40, onPercentChange: vi.fn(), disabled: false, label: 'Share', valueText: '40%',
  onMax: vi.fn(), maxDisabled: true, maxTitle: 'Use remaining',
}

describe('AllocationAmountRow', () => {
  it('keeps the fiat field visible with a zero value while the amount is empty', () => {
    const nodes = elements(AllocationAmountRow(props()))
    const spans = nodes.filter(node => node.type === 'span').map(text)
    expect(spans).toContain('0')
    expect(spans).toContain('$')
  })

  it('shows the converted amount as approximate without the currency symbol', () => {
    const spans = elements(AllocationAmountRow(props({value: '2', fiatDuffs: 200_000_000n}))).filter(node => node.type === 'span').map(text)
    expect(spans).toContain('~ 60.00')
    expect(spans).not.toContain('$60.00')
  })

  it('omits the fiat field until a rate is available', () => {
    fiat.rateReady = false
    const spans = elements(AllocationAmountRow(props())).filter(node => node.type === 'span').map(text)
    expect(spans).not.toContain('$')
  })

  it('renders the slider and Max only when a slider is given', () => {
    expect(elements(AllocationAmountRow(props())).some(node => node.props.type === 'range')).toBe(false)
    const nodes = elements(AllocationAmountRow(props({slider})))
    const range = nodes.find(node => node.props.type === 'range')!
    expect(range.props['aria-label']).toBe('Share')
    const max = nodes.find(node => node.type === 'button')!
    expect(max.props.disabled).toBe(true)
    expect(max.props.title).toBe('Use remaining')
    expect(String(max.props.className)).toContain('disabled:opacity-50')
  })

  it('forwards typed text and left-aligns the amount by default', () => {
    const onChange = vi.fn()
    const input = elements(AllocationAmountRow(props({onChange}))).find(node => node.props.inputMode === 'decimal')!
    ;(input.props.onChange as (event: {target: {value: string}}) => void)({target: {value: '1.5'}})
    expect(onChange).toHaveBeenCalledWith('1.5')
    expect(String(input.props.className)).toContain('text-left')
  })

  it('centres the amount and fiat values when centered', () => {
    const nodes = elements(AllocationAmountRow(props({centered: true, fiatDuffs: 200_000_000n})))
    const input = nodes.find(node => node.props.inputMode === 'decimal')!
    const fiatValue = nodes.find(node => node.type === 'span' && text(node) === '~ 60.00')!
    expect(String(input.props.className)).toContain('text-center')
    expect(String(fiatValue.props.className)).toContain('text-center')
  })
})
