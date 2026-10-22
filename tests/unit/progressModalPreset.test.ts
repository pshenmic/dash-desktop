import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import React, {isValidElement, type ReactElement, type ReactNode} from 'react'
import type {ShieldedSpendState, AssetLockFundingState} from '../../src/renderer/src/api/types'
import type {ShieldedSpendModalProps} from '../../src/renderer/src/types/ShieldedSpendModal'
import type {AssetLockFundingModalProps, AssetLockFundingResumeModalProps, AssetLockFundingStartModalProps} from '../../src/renderer/src/types/AssetLockFundingModal'
import type {ModalActionsProps, ModalProps} from '../../src/renderer/src/types/Modal'
import type {PhaseProgressListProps} from '../../src/renderer/src/types/PhaseProgressList'
import {AssetLockFundingKind} from '../../src/renderer/src/enums/AssetLockFundingKind'
import {AssetLockFundingPhase} from '../../src/renderer/src/enums/AssetLockFundingPhase'
import {ShieldedSpendKind} from '../../src/renderer/src/enums/ShieldedSpendKind'
import {ShieldedSpendPhase} from '../../src/renderer/src/enums/ShieldedSpendPhase'
import {TxEndpointKind} from '../../src/renderer/src/enums/TxEndpointKind'
import {SEND_INPUTS_CHANGED_MESSAGE} from '../../src/renderer/src/constants/sendConfirmModal'
import {assetLockEndpoints} from '../../src/renderer/src/utils/txSummaryEndpoints'

type Element = ReactElement<Record<string, unknown>>

const harness = vi.hoisted(() => ({
  stateIndex: 0,
  refIndex: 0,
  effectIndex: 0,
  states: [] as unknown[],
  refs: [] as {current: unknown}[],
  effects: [] as Array<() => unknown>,
  api: {
    verifyWalletPassword: vi.fn(),
    startAssetLockFunding: vi.fn(),
    resumeAssetLockFunding: vi.fn(),
    getAssetLockFundingState: vi.fn(),
    getShieldedSpendState: vi.fn(),
  },
  toastError: vi.fn(),
}))

vi.mock('react', async importOriginal => ({
  ...await importOriginal<typeof import('react')>(),
  useEffect: (effect: () => unknown) => { harness.effects[harness.effectIndex++] = effect },
  useRef: <T>(initial: T) => {
    const index = harness.refIndex++
    if (!(index in harness.refs)) harness.refs[index] = {current: initial}
    return harness.refs[index]
  },
  useState: <T>(initial: T) => {
    const index = harness.stateIndex++
    if (!(index in harness.states)) harness.states[index] = initial
    return [harness.states[index], (value: T) => { harness.states[index] = value }]
  },
}))
vi.mock('@renderer/components/dash-ui-kit-enxtended', () => ({Text: 'text', SuccessIcon: 'success-icon', CheckIcon: 'check-icon'}))
vi.mock('@renderer/components/ui/Modal', () => ({default: 'dialog'}))
vi.mock('@renderer/components/ui/ModalActions', () => ({default: 'modal-actions'}))
vi.mock('@renderer/components/ui/TxSummary', () => ({default: 'tx-summary'}))
vi.mock('@renderer/components/ui/PasswordField', () => ({default: 'password-field'}))
vi.mock('@renderer/components/ui/Spinner', () => ({default: 'spinner'}))
vi.mock('@renderer/components/ui/HashField', () => ({default: 'hash-field'}))
vi.mock('@renderer/components/ui/CreditsAmount', () => ({default: 'span'}))
vi.mock('@renderer/components/ui/RecipientSummary', () => ({default: 'span'}))
vi.mock('@renderer/components/ui/CopyButton', () => ({default: 'button'}))
vi.mock('@renderer/components/ui/Toast', () => ({toast: {error: harness.toastError}}))
vi.mock('@renderer/contexts/AuthContext', () => ({useAuth: () => ({status: {network: 'testnet'}})}))
vi.mock('@renderer/hooks/useErrorToast', () => ({useErrorToast: () => {}}))
vi.mock('@renderer/api', () => ({API: harness.api}))

import ShieldedSpendModal from '../../src/renderer/src/components/modal/ShieldedSpendModal'
import AssetLockFundingModal from '../../src/renderer/src/components/modal/AssetLockFundingModal'
import PhaseProgressList from '../../src/renderer/src/components/ui/PhaseProgressList'

function render<P>(component: (props: P) => ReactNode, props: P): ReactNode {
  harness.stateIndex = 0
  harness.refIndex = 0
  harness.effectIndex = 0
  return component(props)
}

function runOpenEffect(): void {
  harness.effects[0]()
}

function findAll(node: ReactNode, match: (element: Element) => boolean): Element[] {
  if (Array.isArray(node)) return node.flatMap(child => findAll(child, match))
  if (!isValidElement<Record<string, unknown>>(node)) return []
  return [...(match(node) ? [node] : []), ...findAll(node.props.children as ReactNode, match)]
}

function byType(node: ReactNode, type: unknown): Element[] {
  return findAll(node, element => element.type === type)
}

function progressList(node: ReactNode): PhaseProgressListProps | undefined {
  return byType(node, PhaseProgressList)[0]?.props as unknown as PhaseProgressListProps | undefined
}

function dialog(node: ReactNode): ModalProps {
  return byType(node, 'dialog')[0].props as unknown as ModalProps
}

function primaryLabels(node: ReactNode): ReactNode[] {
  return byType(node, 'modal-actions').map(element => (element.props as unknown as ModalActionsProps).primary.label)
}

function flush(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

function spendState(phase: ShieldedSpendPhase, fetched = 0, total = 0): ShieldedSpendState {
  return {phase, fetched, total, stHash: null, identityId: null, error: null}
}

function lockState(phase: AssetLockFundingPhase): AssetLockFundingState {
  return {phase, kind: AssetLockFundingKind.Address, txid: 'lock-tx', txHeight: null, chainLockedHeight: null, lockKind: null, stHash: null, toPlatformAddress: 'platform-address', identityIdentifier: null, amountDuffs: 5000n, error: null}
}

function spendProps(overrides: Partial<ShieldedSpendModalProps> = {}): ShieldedSpendModalProps {
  return {
    isOpen: true,
    advanced: false,
    onClose: vi.fn(),
    walletId: 'wallet',
    title: 'Send privately',
    kind: ShieldedSpendKind.Transfer,
    from: {value: 'Shielded pool', kind: TxEndpointKind.Label},
    toValue: 'recipient',
    amountCredits: 1000n,
    feeCredits: 10n,
    proverReady: true,
    start: vi.fn(),
    onSuccess: vi.fn(),
    presetPassword: 'secret',
    ...overrides,
  }
}

function lockProps(overrides: Partial<AssetLockFundingStartModalProps> = {}): AssetLockFundingStartModalProps {
  return {
    isOpen: true,
    advanced: false,
    onClose: vi.fn(),
    walletId: 'wallet',
    toPlatformAddress: 'platform-address',
    from: {value: 'Dash Core (L1)', kind: TxEndpointKind.Label},
    kind: AssetLockFundingKind.Address,
    onSuccess: vi.fn(),
    resume: false,
    amountDuffs: 5000n,
    feeDuffs: 20n,
    feeCredits: 30n,
    source: {kind: 'outpoints', outpoints: [{txid: 'coin', vout: 0}]},
    presetPassword: 'secret',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('document', {body: {}})
  vi.stubGlobal('React', React)
  harness.states = []
  harness.refs = []
  harness.effects = []
  harness.api.verifyWalletPassword.mockResolvedValue(true)
})
afterEach(() => vi.unstubAllGlobals())

describe('PhaseProgressList', () => {
  const phases = [
    {key: 'one', label: 'One'},
    {key: 'two', label: 'Two', extra: 'progress'},
    {key: 'three', label: 'Three'},
  ]

  it('marks done, active and pending phases', () => {
    const items = byType(PhaseProgressList({phases, current: 1}), 'li')
    expect(byType(items[0], 'check-icon')[0].props.color).toBe('currentColor')
    expect(byType(items[1], 'spinner')).toHaveLength(1)
    expect(items[1].props['aria-current']).toBe('step')
    expect(byType(items[2], 'div').some(element => String(element.props.className).includes('/15'))).toBe(true)
    expect(byType(items[2], 'text')[0].props.opacity).toBe(50)
    expect(byType(items[0], 'text')[0].props.opacity).toBe(100)
  })

  it('renders a phase extra slot under its row', () => {
    const items = byType(PhaseProgressList({phases, current: 1}), 'li')
    expect(findAll(items[0], element => element.props.children === 'progress')).toHaveLength(0)
    expect(findAll(items[1], element => element.props.children === 'progress')).toHaveLength(1)
  })
})

describe('ShieldedSpendModal preset password', () => {
  it('starts with the preset password and shows the phase list from step one', () => {
    const props = spendProps({start: vi.fn(() => new Promise<ShieldedSpendState>(() => {}))})
    render(ShieldedSpendModal, props)
    runOpenEffect()
    const tree = render(ShieldedSpendModal, props)
    expect(props.start).toHaveBeenCalledOnce()
    expect(props.start).toHaveBeenCalledWith('secret')
    expect(harness.api.verifyWalletPassword).not.toHaveBeenCalled()
    expect(progressList(tree)?.current).toBe(0)
    expect(byType(tree, 'password-field')).toHaveLength(0)
    expect(byType(tree, 'tx-summary')).toHaveLength(0)
    expect(dialog(tree).dismissible).toBe(false)
    expect(dialog(tree).title).toBe(props.title)
  })

  it('starts once when the open effect runs twice', () => {
    const props = spendProps({start: vi.fn(() => new Promise<ShieldedSpendState>(() => {}))})
    render(ShieldedSpendModal, props)
    runOpenEffect()
    render(ShieldedSpendModal, props)
    runOpenEffect()
    expect(props.start).toHaveBeenCalledOnce()
  })

  it('follows the reported phase once started and fills the note bar while syncing', async () => {
    const props = spendProps({start: vi.fn().mockResolvedValue(spendState(ShieldedSpendPhase.Syncing, 5, 10))})
    render(ShieldedSpendModal, props)
    runOpenEffect()
    await flush()
    const list = progressList(render(ShieldedSpendModal, props))
    expect(list?.current).toBe(0)
    expect(list?.phases[0].extra).toBeDefined()
    expect(list?.phases[1].extra).toBeUndefined()
  })

  it('closes with a toast when the inputs changed before the start', async () => {
    const props = spendProps({sourceValid: false, start: vi.fn()})
    render(ShieldedSpendModal, props)
    runOpenEffect()
    await flush()
    expect(props.start).not.toHaveBeenCalled()
    expect(harness.toastError).toHaveBeenCalledWith(SEND_INPUTS_CHANGED_MESSAGE)
    expect(props.onClose).toHaveBeenCalledOnce()
  })

  it('closes without showing the form when the start fails', async () => {
    const props = spendProps({start: vi.fn().mockRejectedValue(new Error('proof failed'))})
    render(ShieldedSpendModal, props)
    runOpenEffect()
    await flush()
    expect(harness.toastError).toHaveBeenCalledWith('proof failed')
    expect(props.onClose).toHaveBeenCalledOnce()
    expect(byType(render(ShieldedSpendModal, props), 'password-field')).toHaveLength(0)
  })

  it('falls back to the form when the prover is not ready', () => {
    const props = spendProps({proverReady: false, start: vi.fn()})
    render(ShieldedSpendModal, props)
    runOpenEffect()
    const tree = render(ShieldedSpendModal, props)
    expect(props.start).not.toHaveBeenCalled()
    expect(byType(tree, 'password-field')).toHaveLength(1)
  })

  it('keeps the confirm form and verifies the typed password without a preset', async () => {
    const props = spendProps({presetPassword: undefined, start: vi.fn().mockResolvedValue(spendState(ShieldedSpendPhase.Proving))})
    render(ShieldedSpendModal, props)
    runOpenEffect()
    const field = byType(render(ShieldedSpendModal, props), 'password-field')[0]
    ;(field.props.onChange as (value: string) => void)('typed')
    const actions = byType(render(ShieldedSpendModal, props), 'modal-actions')[0].props as unknown as ModalActionsProps
    await actions.primary.onClick()
    await flush()
    expect(harness.api.verifyWalletPassword).toHaveBeenCalledWith('wallet', 'typed')
    expect(props.start).toHaveBeenCalledWith('typed')
    expect(progressList(render(ShieldedSpendModal, props))?.current).toBe(1)
  })
})

describe('AssetLockFundingModal preset password', () => {
  it('starts the asset lock with the preset password and stays non-dismissible until it returns', () => {
    harness.api.startAssetLockFunding.mockReturnValue(new Promise(() => {}))
    const props = lockProps()
    render(AssetLockFundingModal, props)
    runOpenEffect()
    const tree = render(AssetLockFundingModal, props)
    expect(harness.api.startAssetLockFunding).toHaveBeenCalledOnce()
    expect(harness.api.startAssetLockFunding).toHaveBeenCalledWith('wallet', 'platform-address', 5000n, 'secret', AssetLockFundingKind.Address, props.source)
    expect(harness.api.verifyWalletPassword).not.toHaveBeenCalled()
    expect(progressList(tree)?.current).toBe(0)
    expect(byType(tree, 'password-field')).toHaveLength(0)
    expect(primaryLabels(tree)).not.toContain('Continue in background')
    expect(dialog(tree).dismissible).toBe(false)
  })

  it('starts once when the open effect runs twice', () => {
    harness.api.startAssetLockFunding.mockReturnValue(new Promise(() => {}))
    const props = lockProps()
    render(AssetLockFundingModal, props)
    runOpenEffect()
    render(AssetLockFundingModal, props)
    runOpenEffect()
    expect(harness.api.startAssetLockFunding).toHaveBeenCalledOnce()
  })

  it('offers to continue in background once the lock is running', async () => {
    harness.api.startAssetLockFunding.mockResolvedValue(lockState(AssetLockFundingPhase.WaitingChainLock))
    const props = lockProps()
    render(AssetLockFundingModal, props)
    runOpenEffect()
    await flush()
    const tree = render(AssetLockFundingModal, props)
    expect(progressList(tree)?.current).toBe(1)
    expect(primaryLabels(tree)).toContain('Continue in background')
    expect(dialog(tree).dismissible).toBe(true)
    expect(byType(tree, 'hash-field')[0].props.hash).toBe('lock-tx')
  })

  it('closes with a toast when the inputs changed before the start', async () => {
    const props = lockProps({sourceValid: false})
    render(AssetLockFundingModal, props)
    runOpenEffect()
    await flush()
    expect(harness.api.startAssetLockFunding).not.toHaveBeenCalled()
    expect(harness.toastError).toHaveBeenCalledWith(SEND_INPUTS_CHANGED_MESSAGE)
    expect(props.onClose).toHaveBeenCalledOnce()
  })

  it('closes without showing the form when the start fails', async () => {
    harness.api.startAssetLockFunding.mockRejectedValue(new Error('broadcast failed'))
    const props = lockProps()
    render(AssetLockFundingModal, props)
    runOpenEffect()
    await flush()
    expect(harness.toastError).toHaveBeenCalledWith('broadcast failed')
    expect(props.onClose).toHaveBeenCalledOnce()
    expect(byType(render(AssetLockFundingModal, props), 'password-field')).toHaveLength(0)
  })

  it('never auto-starts a resume', () => {
    const resume: AssetLockFundingResumeModalProps = {isOpen: true, onClose: vi.fn(), walletId: 'wallet', toPlatformAddress: '', kind: AssetLockFundingKind.Address, onSuccess: vi.fn(), resume: true, amountDuffs: null}
    const props: AssetLockFundingModalProps = Object.assign(resume, {presetPassword: 'secret'})
    render(AssetLockFundingModal, props)
    runOpenEffect()
    const tree = render(AssetLockFundingModal, props)
    expect(harness.api.resumeAssetLockFunding).not.toHaveBeenCalled()
    expect(harness.api.startAssetLockFunding).not.toHaveBeenCalled()
    expect(byType(tree, 'password-field')).toHaveLength(1)
  })

  it('starts a new funding on a preset reopen after a resume was requested in an earlier opening', async () => {
    harness.api.startAssetLockFunding
      .mockResolvedValueOnce(lockState(AssetLockFundingPhase.Resumable))
      .mockReturnValueOnce(new Promise(() => {}))
    const first = lockProps()
    render(AssetLockFundingModal, first)
    runOpenEffect()
    await flush()
    const resume = byType(render(AssetLockFundingModal, first), 'modal-actions')
      .map(element => (element.props as unknown as ModalActionsProps).primary)
      .find(primary => primary.label === 'Resume')
    resume?.onClick()
    const closed = lockProps({isOpen: false})
    render(AssetLockFundingModal, closed)
    runOpenEffect()
    const reopened = lockProps({presetPassword: 'fresh', amountDuffs: 7000n})
    render(AssetLockFundingModal, reopened)
    runOpenEffect()
    await flush()
    expect(resume).toBeDefined()
    expect(harness.api.resumeAssetLockFunding).not.toHaveBeenCalled()
    expect(harness.api.startAssetLockFunding).toHaveBeenCalledTimes(2)
    expect(harness.api.startAssetLockFunding).toHaveBeenLastCalledWith('wallet', 'platform-address', 7000n, 'fresh', AssetLockFundingKind.Address, reopened.source)
  })

  it('summarises the destination with the shared asset-lock endpoints', () => {
    const props = lockProps({presetPassword: undefined, kind: AssetLockFundingKind.Identity, toPlatformAddress: ''})
    render(AssetLockFundingModal, props)
    runOpenEffect()
    const tree = render(AssetLockFundingModal, props)
    expect(byType(tree, 'tx-summary')[0].props.to).toEqual(assetLockEndpoints(AssetLockFundingKind.Identity, ''))
    expect(byType(tree, 'password-field')).toHaveLength(1)
    expect(dialog(tree).dismissible).toBe(true)
  })
})
