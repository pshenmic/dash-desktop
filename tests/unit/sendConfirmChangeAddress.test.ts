import {beforeEach, afterEach, describe, expect, it, vi} from 'vitest'
import React, {isValidElement, type ReactElement, type ReactNode} from 'react'
import type {SendConfirmModalProps} from '../../src/renderer/src/types/SendConfirmModal'
import {TransferOperation} from '../../src/renderer/src/enums/TransferOperation'
import {coreSendChangeTo} from '../../src/renderer/src/utils/changeAddress'

const harness = vi.hoisted(() => ({
  index: 0,
  states: [] as unknown[],
  sourceValid: {current: true},
  verifyPassword: vi.fn(),
  send: vi.fn(),
}))

vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useEffect: () => {},
  useRef: () => harness.sourceValid,
  useState: <T>(initial: T) => {
    const index = harness.index++
    if (!(index in harness.states)) harness.states[index] = initial
    return [harness.states[index], (value: T) => { harness.states[index] = value }]
  },
}))
vi.mock('react-dom', () => ({createPortal: (element: ReactNode) => element}))
vi.mock('dash-ui-kit/react', () => ({useTheme: () => ({theme: 'light'})}))
vi.mock('@renderer/components/dash-ui-kit-enxtended', () => ({Button: 'button', CrossIcon: 'svg', Input: 'input', Text: 'span', SuccessIcon: 'svg', CheckIcon: 'svg'}))
vi.mock('@renderer/components/ui/Spinner', () => ({default: 'span'}))
vi.mock('@renderer/components/ui/CopyableError', () => ({default: 'span'}))
vi.mock('@renderer/components/ui/HashField', () => ({default: 'span'}))
vi.mock('@renderer/components/ui/RecipientSummary', () => ({default: 'span'}))
vi.mock('@renderer/hooks/useWalletTransactions', () => ({refreshTransactions: vi.fn()}))
vi.mock('@renderer/api', () => ({API: {verifyWalletPassword: harness.verifyPassword, sendTransaction: harness.send}}))

import SendConfirmModal from '../../src/renderer/src/components/modal/SendConfirmModal'

function findSignButton(node: ReactNode): ReactElement<{onClick: () => Promise<void>}> | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findSignButton(child)
      if (found) return found
    }
  }
  if (!isValidElement<{children?: ReactNode; onClick?: () => Promise<void>}>(node)) return undefined
  if (node.type === 'button' && Array.isArray(node.props.children) && node.props.children.includes('Sign & Send')) {
    return node as ReactElement<{onClick: () => Promise<void>}>
  }
  return findSignButton(node.props.children)
}

function render(props: SendConfirmModalProps): ReactNode {
  harness.index = 0
  return SendConfirmModal(props)
}

function modalProps(changeTo?: string): SendConfirmModalProps {
  return {isOpen: true, onClose: vi.fn(), walletId: 'wallet', network: 'testnet', recipients: [{address: 'recipient', amountDuffs: 90n}], source: {kind: 'outpoints', outpoints: [{txid: 'coin', vout: 0}]}, changeTo, onSuccess: vi.fn()}
}

describe('Core send confirmation change address', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('document', {body: {}})
    vi.stubGlobal('React', React)
    harness.states = ['password']
    harness.sourceValid.current = true
    harness.verifyPassword.mockResolvedValue(true)
    harness.send.mockResolvedValue({txid: 'sent'})
  })
  afterEach(() => vi.unstubAllGlobals())

  it.each([true, false])('passes the effective fifth IPC argument in advanced=%s without leaking another mode’s draft', async advanced => {
    const changeTo = coreSendChangeTo({advanced, customChangeEnabled: true, operation: TransferOperation.CoreSend, amountDuffs: 90n, maxDuffs: 100n, change: [], selected: '  custom-address  '})
    const props = modalProps(changeTo)
    const button = findSignButton(render(props))
    expect(button).toBeDefined()
    await button!.props.onClick()
    expect(harness.send).toHaveBeenCalledWith('wallet', props.recipients, 'password', props.source, advanced ? 'custom-address' : undefined)
    expect(props.onSuccess).toHaveBeenCalledOnce()
  })

  it('does not send a stale reviewed change address when validity changes during password verification', async () => {
    let finishVerification!: (valid: boolean) => void
    harness.verifyPassword.mockImplementation(() => new Promise<boolean>(resolve => { finishVerification = resolve }))
    const props = modalProps('reviewed-change')
    const pending = findSignButton(render(props))!.props.onClick()
    render({...props, changeTo: 'new-default', sourceValid: false})
    finishVerification(true)
    await pending
    expect(harness.send).not.toHaveBeenCalled()
    expect(props.onSuccess).not.toHaveBeenCalled()
  })

  it('sends automatically after custom change is disabled while retaining the address draft', async () => {
    const changeTo = coreSendChangeTo({advanced: true, customChangeEnabled: false, operation: TransferOperation.CoreSend, amountDuffs: 90n, maxDuffs: 100n, change: [], selected: 'retained-address'})
    const props = modalProps(changeTo)
    await findSignButton(render(props))!.props.onClick()
    expect(harness.send).toHaveBeenCalledWith('wallet', props.recipients, 'password', props.source, undefined)
  })
})
