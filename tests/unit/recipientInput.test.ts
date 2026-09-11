import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { createBase58check } from '@scure/base'
import { sha256 } from '@noble/hashes/sha2.js'

const harness = vi.hoisted(() => ({
  index: 0,
  states: [] as unknown[],
  contacts: [] as Array<{id: number; label: string; address: string}>,
  addContact: vi.fn(),
  deleteContact: vi.fn(),
}))

vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useState: <T>(initial: T) => {
    const index = harness.index++
    if (!(index in harness.states)) harness.states[index] = initial
    return [harness.states[index], (update: T | ((previous: T) => T)) => {
      harness.states[index] = typeof update === 'function' ? (update as (previous: T) => T)(harness.states[index] as T) : update
    }]
  },
  useRef: () => ({current: null}),
  useEffect: () => {},
}))
vi.mock('@renderer/components/dash-ui-kit-enxtended', () => ({Input: 'input', Text: 'span', ChevronIcon: 'chevron'}))
vi.mock('@renderer/components/dash-ui-kit-enxtended/icons', () => ({SearchIcon: 'search', PlusIcon: 'plus', DeleteIcon: 'delete', CheckIcon: 'check'}))
vi.mock('dash-ui-kit/react', () => ({Identifier: 'identifier'}))
vi.mock('@renderer/hooks/useClickOutside', () => ({useClickOutside: () => {}}))
vi.mock('@renderer/hooks/useAddressBook', () => ({useAddressBook: () => ({contacts: harness.contacts, network: 'testnet', addContact: harness.addContact, deleteContact: harness.deleteContact})}))
vi.mock('@renderer/components/ui/Toast', () => ({toast: {error: vi.fn()}}))

import RecipientInput from '../../src/renderer/src/components/pages/transfer/RecipientInput'
import DropdownField from '../../src/renderer/src/components/ui/DropdownField'
import { sendPageData } from '../../src/renderer/src/constants/sendPages'
import type { DropdownFieldOption, DropdownFieldProps } from '../../src/renderer/src/types/DropdownField'

function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!isValidElement<Record<string, unknown>>(node)) return []
  return [node, ...elements(node.props.children as ReactNode)]
}

function renderRecipient(value: string, onChange = vi.fn(), ownOptions: DropdownFieldOption[] = [{value: 'own', label: 'own'}]) {
  harness.index = 0
  return RecipientInput({value, onChange, ownOptions, data: sendPageData.recipient})
}

beforeEach(() => {
  vi.stubGlobal('React', React)
  harness.states = []
  harness.contacts = []
  harness.addContact.mockReset().mockResolvedValue(undefined)
  harness.deleteContact.mockReset().mockResolvedValue(undefined)
})

afterEach(() => vi.unstubAllGlobals())

describe('Simple recipient input', () => {
  it('keeps the same controlled value and callback for typed and wallet-selected recipients', () => {
    const onChange = vi.fn()
    const dropdown = elements(renderRecipient('  unfinished  ', onChange)).find(node => node.type === DropdownField)!
    const props = dropdown.props as unknown as DropdownFieldProps
    expect(props.value).toBe('  unfinished  ')
    expect(props.inputInvalid).toBe(true)
    expect(props.options).toEqual([{value: 'own', label: 'own'}])
    harness.index = 0
    harness.states = []
    let tree = DropdownField(props)
    const input = elements(tree).find(node => node.type === 'input')!
    ;(input.props.onChange as (event: {target: {value: string}}) => void)({target: {value: 'typed-address'}})
    expect(onChange).toHaveBeenLastCalledWith('typed-address')
    const toggle = elements(tree).find(node => node.props['aria-label'] === 'Choose recipient')!
    ;(toggle.props.onClick as () => void)()
    harness.index = 0
    tree = DropdownField(props)
    const option = elements(tree).find(node => node.key === 'own')!
    ;(option.props.onClick as () => void)()
    expect(onChange).toHaveBeenLastCalledWith('own')
    expect(harness.states[0]).toBe(false)
  })

  it('shows a heading and balance with transaction count beside each wallet address', () => {
    const dropdown = elements(renderRecipient('', vi.fn(), [{
      value: 'own', label: 'own', description: 'Your receiving address · Savings', metadata: ['1.25 Dash', 'Tx count: 4'],
    }])).find(node => node.type === DropdownField)!
    const props = dropdown.props as unknown as DropdownFieldProps
    expect(props.menuHeading).toBe('Your addresses')
    harness.index = 0
    harness.states = [true]
    const nodes = elements(DropdownField(props))
    const heading = nodes.find(node => node.props.role === 'heading')!
    expect(elements(heading).some(node => node.props.children === 'Your addresses')).toBe(true)
    const option = nodes.find(node => node.key === 'own')!
    const optionText = elements(option).map(node => node.props.children)
    expect(optionText).toEqual(expect.arrayContaining(['own', 'Your receiving address · Savings', '1.25 Dash', 'Tx count: 4']))
    expect(elements(heading).some(node => node.type === 'button')).toBe(false)
  })

  it('retains contact saving, selection and deletion alongside own address options', async () => {
    const address = createBase58check(sha256).encode(Uint8Array.from([140, ...Array(20).fill(1)]))
    const onChange = vi.fn()
    let tree = renderRecipient(address, onChange)
    const saveCurrent = elements(tree).find(node => elements(node.props.children as ReactNode).some(child => child.props.children === 'Save current') && node.type === 'button')!
    ;(saveCurrent.props.onClick as () => void)()
    tree = renderRecipient(address, onChange)
    const name = elements(tree).find(node => node.props.placeholder === 'Contact name')!
    ;(name.props.onChange as (event: {target: {value: string}}) => void)({target: {value: '  Friend  '}})
    tree = renderRecipient(address, onChange)
    const save = elements(tree).find(node => node.type === 'button' && elements(node.props.children as ReactNode).some(child => child.props.children === 'Save'))!
    await (save.props.onClick as () => Promise<void>)()
    expect(harness.addContact).toHaveBeenCalledWith('Friend', address)

    harness.contacts = [{id: 7, label: 'Friend', address}]
    tree = renderRecipient('', onChange)
    const select = elements(tree).find(node => node.type === 'button' && elements(node.props.children as ReactNode).some(child => child.props.children === address))!
    ;(select.props.onClick as () => void)()
    expect(onChange).toHaveBeenLastCalledWith(address)
    const remove = elements(tree).find(node => node.props.title === 'Remove contact')!
    ;(remove.props.onClick as () => void)()
    expect(harness.deleteContact).toHaveBeenCalledWith(7)
  })

  it('still marks addresses from another network invalid and does not offer saving them', () => {
    const mainnetAddress = createBase58check(sha256).encode(Uint8Array.from([76, ...Array(20).fill(2)]))
    const nodes = elements(renderRecipient(mainnetAddress))
    expect(nodes.find(node => node.type === DropdownField)?.props.inputInvalid).toBe(true)
    expect(nodes.some(node => node.props.children === 'Save current')).toBe(false)
  })
})
