import {afterEach, beforeEach, describe, expect, it, vi, type Mock} from 'vitest'
import React, {isValidElement, type ReactElement, type ReactNode} from 'react'
import type {ModalActionsProps, ModalProps} from '../../src/renderer/src/types/Modal'
import type {PasswordFieldProps} from '../../src/renderer/src/types/PasswordField'
import type {CoreRecipient, CoreSpendSource} from '../../src/renderer/src/api/types'
import {TxEndpointKind} from '../../src/renderer/src/enums/TxEndpointKind'
import {SEND_INPUTS_CHANGED_MESSAGE, SEND_PROGRESS_TITLE, SHIELD_PROGRESS_TITLE} from '../../src/renderer/src/constants/sendConfirmModal'

const harness = vi.hoisted(() => ({
  stateIndex: 0,
  refIndex: 0,
  states: [] as unknown[],
  refs: [] as {current: unknown}[],
  effects: [] as (() => void)[],
  rendering: false,
  renderUpdates: 0,
  verifyPassword: vi.fn(),
  sendTransaction: vi.fn(),
  shieldToPool: vi.fn(),
  run: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useEffect: (effect: () => void) => { harness.effects.push(effect) },
  useRef: <T>(initial: T) => {
    const index = harness.refIndex++
    if (!(index in harness.refs)) harness.refs[index] = {current: initial}
    return harness.refs[index]
  },
  useState: <T>(initial: T) => {
    const index = harness.stateIndex++
    if (!(index in harness.states)) harness.states[index] = initial
    return [harness.states[index], (value: T) => {
      harness.states[index] = value
      if (harness.rendering) harness.renderUpdates++
    }]
  },
}))
vi.mock('@renderer/components/dash-ui-kit-extended', () => ({Input: 'input', Text: 'span', SuccessIcon: 'svg', CheckIcon: 'svg'}))
vi.mock('@renderer/components/ui/Modal', () => ({default: 'dialog'}))
vi.mock('@renderer/components/ui/ModalActions', () => ({default: 'modal-actions'}))
vi.mock('@renderer/components/ui/PasswordField', () => ({default: 'password-field'}))
vi.mock('@renderer/components/ui/PendingRow', () => ({default: 'pending-row'}))
vi.mock('@renderer/components/ui/TxSummary', () => ({default: 'section'}))
vi.mock('@renderer/components/ui/Spinner', () => ({default: 'span'}))
vi.mock('@renderer/components/ui/HashField', () => ({default: 'span'}))
vi.mock('@renderer/components/ui/RecipientSummary', () => ({default: 'span'}))
vi.mock('@renderer/components/ui/CreditsAmount', () => ({default: 'span'}))
vi.mock('@renderer/components/ui/Toast', () => ({toast: {error: harness.toastError}}))
vi.mock('@renderer/contexts/AuthContext', () => ({useAuth: () => ({status: {network: 'testnet', selectedWalletId: 'wallet'}})}))
vi.mock('@renderer/hooks/useWalletTransactions', () => ({refreshTransactions: vi.fn()}))
vi.mock('@renderer/api', () => ({API: {verifyWalletPassword: harness.verifyPassword, sendTransaction: harness.sendTransaction, shieldToPool: harness.shieldToPool}}))

import SendConfirmModal from '../../src/renderer/src/components/modal/SendConfirmModal'
import TransferConfirmModal from '../../src/renderer/src/components/modal/TransferConfirmModal'
import ShieldConfirmModal from '../../src/renderer/src/components/modal/ShieldConfirmModal'

interface CommonProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  presetPassword?: string
  sourceValid?: boolean
}

interface ModalCase {
  name: string
  progressTitle: string
  formTitle: string
  start: Mock
  startArgs: (secret: string) => unknown[]
  view: (common: CommonProps) => ReactNode
}

const FROM = {value: 'Dash Core', kind: TxEndpointKind.Label}
const RECIPIENTS: CoreRecipient[] = [{address: 'recipient', amountDuffs: 90n}]
const SOURCE: CoreSpendSource = {kind: 'outpoints', outpoints: [{txid: 'coin', vout: 0}]}

const CASES: ModalCase[] = [
  {
    name: 'SendConfirmModal',
    progressTitle: SEND_PROGRESS_TITLE,
    formTitle: 'Confirm send',
    start: harness.sendTransaction,
    startArgs: secret => ['wallet', RECIPIENTS, secret, SOURCE, undefined],
    view: common => SendConfirmModal({walletId: 'wallet', network: 'testnet', recipients: RECIPIENTS, from: FROM, source: SOURCE, feeDuffs: 1n, ...common}),
  },
  {
    name: 'TransferConfirmModal',
    progressTitle: 'Transfer credits',
    formTitle: 'Transfer credits',
    start: harness.run,
    startArgs: secret => [secret],
    view: common => TransferConfirmModal({title: 'Transfer credits', successTitle: 'Credits sent', summary: {unit: 'credits', amount: 1_000n, from: FROM, to: []}, run: harness.run, ...common}),
  },
  {
    name: 'ShieldConfirmModal',
    progressTitle: SHIELD_PROGRESS_TITLE,
    formTitle: 'Confirm shield',
    start: harness.shieldToPool,
    startArgs: secret => ['wallet', null, 'shielded-address', 1_000n, secret],
    view: common => ShieldConfirmModal({walletId: 'wallet', source: null, from: FROM, toAddress: 'shielded-address', amountCredits: 1_000n, feeCredits: 10n, totalCredits: 1_010n, proverReady: true, ...common}),
  },
]

function render(view: () => ReactNode): ReactNode {
  for (let pass = 0; pass < 25; pass++) {
    harness.stateIndex = 0
    harness.refIndex = 0
    harness.effects = []
    harness.renderUpdates = 0
    harness.rendering = true
    const node = view()
    harness.rendering = false
    if (harness.renderUpdates === 0) return node
  }
  throw new Error('Too many re-renders')
}

function runEffects(): void {
  for (const effect of harness.effects) effect()
}

function flush(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

function find(node: ReactNode, type: string): ReactElement[] {
  if (Array.isArray(node)) return node.flatMap(child => find(child, type))
  if (!isValidElement<{children?: ReactNode}>(node)) return []
  return [...node.type === type ? [node] : [], ...find(node.props.children, type)]
}

function title(node: ReactNode): string {
  return (node as ReactElement<ModalProps>).props.title
}

function typePassword(node: ReactNode, value: string): void {
  (find(node, 'password-field')[0] as ReactElement<PasswordFieldProps>).props.onChange(value)
}

async function confirm(node: ReactNode): Promise<void> {
  await (find(node, 'modal-actions')[0] as ReactElement<ModalActionsProps>).props.primary.onClick()
}

function commonProps(overrides: Partial<CommonProps> = {}): CommonProps {
  return {isOpen: true, onClose: vi.fn(), onSuccess: vi.fn(), ...overrides}
}

function open(modal: ModalCase, common: CommonProps): ReactNode {
  render(() => modal.view(common))
  runEffects()
  return render(() => modal.view(common))
}

function reset(): void {
  vi.clearAllMocks()
  vi.stubGlobal('document', {body: {}})
  vi.stubGlobal('React', React)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  harness.states = []
  harness.refs = []
}

function restore(): void {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
}

describe.each(CASES)('$name preset password', modal => {
  beforeEach(() => {
    reset()
    harness.verifyPassword.mockResolvedValue(true)
    harness.sendTransaction.mockResolvedValue({txid: 'sent', amount: 90n, fee: 1n})
    harness.run.mockResolvedValue({stHash: 'hash', amountCredits: 1_000n, feeCredits: 10n, fromAddress: 'from', toAddress: 'to'})
    harness.shieldToPool.mockResolvedValue({stHash: 'hash', amountCredits: 1_000n, fromAddress: 'from'})
  })
  afterEach(restore)

  it('starts with the preset password and shows only the pending row', async () => {
    const common = commonProps({presetPassword: 'secret'})
    const pending = open(modal, common)
    expect(title(pending)).toBe(modal.progressTitle)
    expect(find(pending, 'pending-row')).toHaveLength(1)
    expect(find(pending, 'password-field')).toHaveLength(0)
    expect(find(pending, 'modal-actions')).toHaveLength(0)
    await flush()
    expect(modal.start).toHaveBeenCalledExactlyOnceWith(...modal.startArgs('secret'))
    expect(harness.verifyPassword).not.toHaveBeenCalled()
    expect(common.onSuccess).toHaveBeenCalledOnce()
    expect(common.onClose).not.toHaveBeenCalled()
    expect(find(render(() => modal.view(common)), 'pending-row')).toHaveLength(0)
  })

  it('commits the pending row, not the form, on the first render after a closed modal opens', () => {
    const common = commonProps({presetPassword: 'secret'})
    render(() => modal.view({...common, isOpen: false}))
    runEffects()
    const first = render(() => modal.view(common))
    expect(title(first)).toBe(modal.progressTitle)
    expect(find(first, 'pending-row')).toHaveLength(1)
    expect(find(first, 'password-field')).toHaveLength(0)
    expect(find(first, 'modal-actions')).toHaveLength(0)
  })

  it('commits the form, not the pending row, on the first render of a plain open after a preset session', async () => {
    const common = commonProps({presetPassword: 'secret'})
    open(modal, common)
    await flush()
    render(() => modal.view({...common, isOpen: false}))
    runEffects()
    const first = render(() => modal.view({...common, presetPassword: undefined}))
    expect(title(first)).toBe(modal.formTitle)
    expect(find(first, 'pending-row')).toHaveLength(0)
    expect(find(first, 'password-field')).toHaveLength(1)
  })

  it('starts once when StrictMode runs the open effect twice, and again after a reopen', async () => {
    const common = commonProps({presetPassword: 'secret'})
    render(() => modal.view(common))
    runEffects()
    runEffects()
    await flush()
    expect(modal.start).toHaveBeenCalledOnce()
    render(() => modal.view({...common, isOpen: false}))
    runEffects()
    open(modal, common)
    await flush()
    expect(modal.start).toHaveBeenCalledTimes(2)
  })

  it('closes with a toast when the inputs changed before the start', async () => {
    const common = commonProps({presetPassword: 'secret', sourceValid: false})
    open(modal, common)
    await flush()
    expect(modal.start).not.toHaveBeenCalled()
    expect(harness.toastError).toHaveBeenCalledExactlyOnceWith(SEND_INPUTS_CHANGED_MESSAGE)
    expect(common.onClose).toHaveBeenCalledOnce()
  })

  it('closes after a rejected start without showing the form', async () => {
    modal.start.mockRejectedValueOnce(new Error('broadcast failed'))
    const common = commonProps({presetPassword: 'secret'})
    open(modal, common)
    await flush()
    expect(harness.toastError).toHaveBeenCalledExactlyOnceWith('broadcast failed')
    expect(common.onClose).toHaveBeenCalledOnce()
    expect(common.onSuccess).not.toHaveBeenCalled()
    expect(find(render(() => modal.view(common)), 'password-field')).toHaveLength(0)
  })

  it('keeps the password form and its verification without a preset', async () => {
    const common = commonProps()
    const form = open(modal, common)
    expect(title(form)).toBe(modal.formTitle)
    expect(find(form, 'pending-row')).toHaveLength(0)
    typePassword(form, 'typed')
    await confirm(render(() => modal.view(common)))
    expect(harness.verifyPassword).toHaveBeenCalledExactlyOnceWith('wallet', 'typed')
    expect(modal.start).toHaveBeenCalledExactlyOnceWith(...modal.startArgs('typed'))
    expect(common.onSuccess).toHaveBeenCalledOnce()
  })

  it('returns to the form after a failed start without a preset', async () => {
    modal.start.mockRejectedValueOnce(new Error('broadcast failed'))
    const common = commonProps()
    typePassword(open(modal, common), 'typed')
    await confirm(render(() => modal.view(common)))
    expect(harness.toastError).toHaveBeenCalledExactlyOnceWith('broadcast failed')
    expect(common.onClose).not.toHaveBeenCalled()
    expect(find(render(() => modal.view(common)), 'password-field')).toHaveLength(1)
  })
})

describe('ShieldConfirmModal without a ready prover', () => {
  beforeEach(reset)
  afterEach(restore)

  it('falls back to the password form instead of starting', async () => {
    const common = commonProps({presetPassword: 'secret'})
    const view = (): ReactNode => ShieldConfirmModal({walletId: 'wallet', source: null, from: FROM, toAddress: 'shielded-address', amountCredits: 1_000n, feeCredits: 10n, totalCredits: 1_010n, proverReady: false, ...common})
    render(view)
    runEffects()
    await flush()
    const form = render(view)
    expect(harness.shieldToPool).not.toHaveBeenCalled()
    expect(title(form)).toBe('Confirm shield')
    expect(find(form, 'password-field')).toHaveLength(1)
  })
})
