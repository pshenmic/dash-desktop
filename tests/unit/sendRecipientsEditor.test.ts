import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import React, {isValidElement, type ReactElement, type ReactNode} from 'react'
import {bech32m} from '@scure/base'
import {DestinationKind} from '../../src/renderer/src/enums/DestinationKind'
import {DESTINATION_PLACEHOLDERS} from '../../src/renderer/src/constants/sendPages'
import type {SendRecipientsEditorProps} from '../../src/renderer/src/types/SendRecipients'

vi.mock('@renderer/components/dash-ui-kit-enxtended', () => ({PlusIcon: 'svg', Text: 'span'}))
vi.mock('@renderer/contexts/AuthContext', () => ({useAuth: () => ({status: {network: 'testnet'}})}))
vi.mock('@renderer/components/ui/AllocationAmountRow', () => ({default: 'allocation-row'}))
vi.mock('@renderer/components/ui/CreditsAmount', () => ({default: 'span'}))
vi.mock('@renderer/components/ui/FadingScrollArea', () => ({default: 'div'}))
vi.mock('@renderer/components/pages/transfer/RecipientInput', () => ({default: 'recipient-input'}))

import SendRecipientsEditor from '../../src/renderer/src/components/pages/transfer/SendRecipientsEditor'

type Node = ReactElement<Record<string, unknown>>

function elements(node: ReactNode): Node[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!isValidElement<{children?: ReactNode}>(node)) return []
  return [node as Node, ...elements(node.props.children)]
}

function props(overrides: Partial<SendRecipientsEditorProps> = {}): SendRecipientsEditorProps {
  return {
    recipients: [{id: 'a', address: '', amount: ''}],
    errors: [{address: null, amount: null}],
    limit: 5,
    destination: DestinationKind.PlatformAddress,
    budgetDuffs: 100_000_000n,
    feeRecipientId: null,
    feeCredits: null,
    budgetIsEstimate: false,
    onChange: vi.fn(),
    ...overrides,
  }
}

const platformAddress = bech32m.encode('tdash', bech32m.toWords(Uint8Array.from([0xb0, ...Array(20).fill(1)])))

beforeEach(() => vi.stubGlobal('React', React))

afterEach(() => vi.unstubAllGlobals())

describe('SendRecipientsEditor', () => {
  it.each([DestinationKind.PlatformAddress, DestinationKind.Identity, DestinationKind.Shielded])('renders %s recipients through RecipientInput', destination => {
    const input = elements(SendRecipientsEditor(props({destination}))).find(node => node.type === 'recipient-input')!
    expect(input.props.compact).toBe(true)
    expect(input.props.appearance).toBe('subtle')
    expect((input.props.data as {placeholder: string}).placeholder).toBe(DESTINATION_PLACEHOLDERS[destination].testnet)
  })

  it('validates Platform recipients as Platform addresses', () => {
    const input = elements(SendRecipientsEditor(props())).find(node => node.type === 'recipient-input')!
    const validate = input.props.validate as (value: string) => boolean
    expect(validate(platformAddress)).toBe(true)
    expect(validate('4EfA9Jrvv3nnCFdSf7fad59851iiTRZ6Wcu6YVJ4iSeF')).toBe(false)
  })

  it('keeps the new identity recipient read-only', () => {
    const nodes = elements(SendRecipientsEditor(props({destination: DestinationKind.NewIdentity})))
    expect(nodes.some(node => node.type === 'recipient-input')).toBe(false)
    const input = nodes.find(node => node.type === 'input')!
    expect(input.props.readOnly).toBe(true)
    expect(input.props.value).toBe('New identity')
  })

  it('drops the slider for fixed denominations', () => {
    const withSlider = elements(SendRecipientsEditor(props())).find(node => node.type === 'allocation-row')!
    expect(withSlider.props.slider).toBeDefined()
    const denominations = elements(SendRecipientsEditor(props({amountDenominations: [100_000_000n]}))).find(node => node.type === 'allocation-row')!
    expect(denominations.props.slider).toBeUndefined()
  })

  it('caps typed amounts to the remaining budget', () => {
    const onChange = vi.fn()
    const row = elements(SendRecipientsEditor(props({onChange}))).find(node => node.type === 'allocation-row')!
    ;(row.props.onChange as (value: string) => void)('5')
    expect(onChange).toHaveBeenCalledWith([{id: 'a', address: '', amount: '1'}])
  })
})
