import { useEffect, useRef, useState } from 'react'
import { Input, Text, SuccessIcon, CheckIcon } from '../dash-ui-kit-enxtended'
import { API } from '@renderer/api'
import { AssetLockFundingKind, AssetLockFundingState } from '@renderer/api/types'
import { AssetLockFundingPhase } from '@renderer/enums/AssetLockFundingPhase'
import { LockKind } from '@renderer/enums/LockKind'
import { ModalSize } from '@renderer/enums/ModalSize'
import Spinner from '@renderer/components/ui/Spinner'
import Modal from '@renderer/components/ui/Modal'
import ModalActions from '@renderer/components/ui/ModalActions'
import HashField from '@renderer/components/ui/HashField'
import CopyableError from '@renderer/components/ui/CopyableError'
import CopyButton from '@renderer/components/ui/CopyButton'
import TxSummary from '@renderer/components/ui/TxSummary'
import { useAuth } from '@renderer/contexts/AuthContext'
import { transactionUrl, platformTransactionUrl } from '@renderer/utils/explorer'
import { ASSET_LOCK_FUNDING_POLL_MS, INVALID_WALLET_PASSWORD_MESSAGE } from '@renderer/constants'
import { TxEndpointKind } from '@renderer/enums/TxEndpointKind'
import { assetLockSummaryCosts, resumedAssetLockAmount } from '@renderer/utils/txSummaryCosts'
import type { AssetLockFundingModalProps } from '@renderer/types/AssetLockFundingModal'
import type { TxSummaryEndpoint } from '@renderer/types/TxSummary'

const PHASE_LABELS: Record<AssetLockFundingKind, ReadonlyArray<{key: AssetLockFundingPhase; label: string}>> = {
  address: [
    { key: AssetLockFundingPhase.BroadcastingL1, label: 'Broadcasting the L1 asset lock transaction' },
    { key: AssetLockFundingPhase.WaitingChainLock, label: 'Waiting for a network lock' },
    { key: AssetLockFundingPhase.BroadcastingST, label: 'Crediting the Platform address' },
  ],
  shielded: [
    { key: AssetLockFundingPhase.BroadcastingL1, label: 'Broadcasting the L1 asset lock transaction' },
    { key: AssetLockFundingPhase.WaitingChainLock, label: 'Waiting for a network lock' },
    { key: AssetLockFundingPhase.BroadcastingST, label: 'Proving and shielding the credits' },
  ],
  identity: [
    { key: AssetLockFundingPhase.BroadcastingL1, label: 'Broadcasting the L1 asset lock transaction' },
    { key: AssetLockFundingPhase.WaitingChainLock, label: 'Waiting for a network lock' },
    { key: AssetLockFundingPhase.BroadcastingST, label: 'Registering the identity on Platform' },
  ],
  identityTopUp: [
    { key: AssetLockFundingPhase.BroadcastingL1, label: 'Broadcasting the L1 asset lock transaction' },
    { key: AssetLockFundingPhase.WaitingChainLock, label: 'Waiting for a network lock' },
    { key: AssetLockFundingPhase.BroadcastingST, label: 'Topping up the identity on Platform' },
  ],
}

function lockStepLabel(state: AssetLockFundingState, active: boolean): string {
  if (state.lockKind === LockKind.Instant) return 'InstantSend lock received'
  if (state.lockKind === LockKind.Chain) return 'ChainLock received'
  if (active) return 'Waiting for an InstantSend lock (usually seconds; ChainLock fallback takes minutes)'
  return 'Network lock (InstantSend or ChainLock)'
}

const TEXTS: Record<AssetLockFundingKind, {title: string; resumeTitle: string; doneTitle: string; doneHeading: string; doneNote: string; emptyTo: string; confirm: string}> = {
  address: {
    title: 'Fund Platform address',
    resumeTitle: 'Resume funding',
    doneTitle: 'Address funded',
    doneHeading: 'Platform address funded',
    doneNote: 'The locked Dash is now available as credits.',
    emptyTo: '',
    confirm: 'Sign & Send',
  },
  shielded: {
    title: 'Shield from L1',
    resumeTitle: 'Resume shielding',
    doneTitle: 'Credits shielded',
    doneHeading: 'Credits shielded',
    doneNote: "The locked Dash is now a note in the recipient's shielded balance.",
    emptyTo: '',
    confirm: 'Sign & Send',
  },
  identity: {
    title: 'Register identity',
    resumeTitle: 'Resume registration',
    doneTitle: 'Identity registered',
    doneHeading: 'Identity registered',
    doneNote: "The locked Dash is now this identity's credit balance.",
    emptyTo: 'New Platform identity with 6 keys',
    confirm: 'Sign & Send',
  },
  identityTopUp: {
    title: 'Top up identity from L1',
    resumeTitle: 'Resume top-up',
    doneTitle: 'Identity topped up',
    doneHeading: 'Identity topped up',
    doneNote: "The locked Dash is now credits on the identity's balance.",
    emptyTo: '',
    confirm: 'Sign & Send',
  },
}

function phaseIndex(phase: AssetLockFundingPhase): number {
  if (phase === AssetLockFundingPhase.Building || phase === AssetLockFundingPhase.BroadcastingL1) return 0
  if (phase === AssetLockFundingPhase.WaitingChainLock) return 1
  if (phase === AssetLockFundingPhase.BroadcastingST) return 2
  if (phase === AssetLockFundingPhase.Done) return 3
  return 0
}

export default function AssetLockFundingModal(props: AssetLockFundingModalProps): React.JSX.Element {
  const {
    isOpen,
    advanced = true,
    onClose,
    walletId,
    toPlatformAddress,
    from,
    resume,
    kind,
    sourceValid = true,
    onSuccess,
  } = props
  const sourceValidRef = useRef(sourceValid)
  sourceValidRef.current = sourceValid
  const { status } = useAuth()
  const network = status?.network ?? null
  const [password, setPassword] = useState('')
  const [preError, setPreError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [started, setStarted] = useState(false)
  const [state, setState] = useState<AssetLockFundingState | null>(null)
  const notified = useRef(false)

  useEffect(() => {
    if (isOpen) {
      setPassword('')
      setPreError(null)
      setBusy(false)
      setStarted(false)
      setState(null)
      notified.current = false
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !resume || !walletId) return
    let dead = false

    API.getAssetLockFundingState(walletId)
      .then((current) => {
        if (
          dead
          || current.kind !== kind
          || current.phase === AssetLockFundingPhase.Idle
          || current.phase === AssetLockFundingPhase.Resumable
        ) return
        setState(current)
        setStarted(true)
      })
      .catch(() => {})

    return () => { dead = true }
  }, [isOpen, resume, walletId, kind])

  useEffect(() => {
    if (!started || !walletId) return
    let dead = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const poll = async (): Promise<void> => {
      try {
        const next = await API.getAssetLockFundingState(walletId)
        if (dead) return
        setState(next)
        if (next.phase === AssetLockFundingPhase.Done && !notified.current) {
          notified.current = true
          onSuccess()
        }
        if (next.phase !== AssetLockFundingPhase.Done && next.phase !== AssetLockFundingPhase.Error && next.phase !== AssetLockFundingPhase.Resumable) {
          timer = setTimeout(() => { void poll() }, ASSET_LOCK_FUNDING_POLL_MS)
        }
      } catch {
        if (!dead) timer = setTimeout(() => { void poll() }, ASSET_LOCK_FUNDING_POLL_MS)
      }
    }
    void poll()

    return () => {
      dead = true
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [started, walletId, onSuccess])

  const running = started && state != null && state.phase !== AssetLockFundingPhase.Done && state.phase !== AssetLockFundingPhase.Error && state.phase !== AssetLockFundingPhase.Resumable

  const handleConfirm = async (): Promise<void> => {
    if (!walletId || password.length === 0 || busy || started || !sourceValidRef.current) return
    setBusy(true)
    setPreError(null)
    try {
      const ok = await API.verifyWalletPassword(walletId, password)
      if (!ok) {
        setPreError(INVALID_WALLET_PASSWORD_MESSAGE)
        setBusy(false)
        return
      }
      if (!sourceValidRef.current) {
        setBusy(false)
        return
      }
      const initial = props.resume
        ? await API.resumeAssetLockFunding(walletId, password)
        : await API.startAssetLockFunding(walletId, toPlatformAddress, props.amountDuffs, password, kind, props.source)
      setState(initial)
      setStarted(true)
      setBusy(false)
    } catch (e) {
      setPreError(e instanceof Error ? e.message : 'Could not start the funding.')
      setBusy(false)
    }
  }

  const requestClose = (): void => {
    onClose()
  }

  const isDone = started && state?.phase === AssetLockFundingPhase.Done
  const doneTxid = state?.txid ?? null
  const isError = started && (state?.phase === AssetLockFundingPhase.Error || state?.phase === AssetLockFundingPhase.Resumable)
  const texts = TEXTS[kind]
  const phases = PHASE_LABELS[kind]
  let modalTitle = texts.title
  if (isDone) modalTitle = texts.doneTitle
  else if (resume) modalTitle = texts.resumeTitle
  let confirmLabel = advanced ? texts.confirm : 'Confirm'
  if (busy) confirmLabel = 'Starting…'
  else if (resume) confirmLabel = 'Resume'

  const to: TxSummaryEndpoint[] = []
  if (toPlatformAddress) to.push({ value: toPlatformAddress, kind: kind === AssetLockFundingKind.Shielded ? TxEndpointKind.Shielded : TxEndpointKind.Address })
  else if (texts.emptyTo) to.push({ value: texts.emptyTo, kind: TxEndpointKind.Label })

  const costs = props.resume ? undefined : assetLockSummaryCosts(kind, props.amountDuffs, props.feeDuffs, props.feeCredits)

  return (
    <Modal open={isOpen} onClose={requestClose} title={modalTitle} size={ModalSize.Lg}>
      {!started && (
        <div className={"phase-fade-in"} key={"confirm"}>
          <TxSummary
            unit={"duffs"}
            amount={props.resume ? resumedAssetLockAmount(kind, props.amountDuffs) : props.amountDuffs}
            from={from}
            to={to}
            fees={costs?.fees}
            total={costs?.total}
            details={costs?.details}
            className={"mt-4"}
          />

          <Text size={14} weight={"medium"} color={"brand"} opacity={40} className={"mt-4 block"}>
            Enter your wallet password. The funding waits for the network to lock the L1 transaction — usually a few seconds with InstantSend, or a few minutes if it falls back to a ChainLock. If the app is closed meanwhile, the funding can be resumed.
          </Text>
          <div className={"mt-2"}>
            <Input
              id={"asset-lock-password"}
              type={"password"}
              placeholder={"Wallet password"}
              value={password}
              variant={"outlined"}
              onChange={(e) => { setPreError(null); setPassword(e.target.value) }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm() }}
              className={"h-14.25 rounded-[1.25rem] bg-transparent!"}
              colorScheme={preError ? 'error' : 'primary'}
              disabled={busy}
              autoFocus
            />
          </div>
          <div className={`overflow-hidden transition-all duration-200 ${preError ? 'max-h-12 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
            <CopyableError message={preError ?? ''} />
          </div>

          <ModalActions
            secondary={{ label: 'Cancel', onClick: requestClose, disabled: busy }}
            primary={{
              label: confirmLabel,
              onClick: handleConfirm,
              disabled: password.length === 0 || !sourceValid,
              loading: busy,
            }}
          />
        </div>
      )}

      {running && state && (
        <div className={"phase-fade-in"} key={"progress"}>
          <div className={"mt-5 flex flex-col gap-4 p-[.875rem] rounded-[.9375rem] dash-block"}>
            {phases.map((p, i) => {
              const current = phaseIndex(state.phase)
              const done = i < current
              const active = i === current
              const label = p.key === AssetLockFundingPhase.WaitingChainLock ? lockStepLabel(state, active) : p.label
              return (
                <div key={p.key} className={"flex items-center gap-2"}>
                  {done && <CheckIcon size={14} className={"text-dash-brand dark:text-dash-mint [&_circle]:hidden"} />}
                  {!done && active && <Spinner size={14} className={"text-dash-brand dark:text-dash-mint"} />}
                  {!done && !active && <div className={"size-3.5 rounded-full border border-dash-primary-dark-blue/20 dark:border-white/20"} />}
                  <Text size={14} weight={"medium"} color={"brand"} opacity={active || done ? 100 : 40}>{label}</Text>
                </div>
              )
            })}
          </div>
          {state.txid && (
            <div className={"mt-3"}>
              <HashField hash={state.txid} label={"L1 txid"} explorerUrl={network ? transactionUrl(state.txid, network) : null} />
            </div>
          )}
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"mt-2 block"}>
            You can close this window — the funding keeps running and its progress remains available in the wallet.
          </Text>
        </div>
      )}

      {isError && state && (
        <div className={"phase-fade-in"} key={"error"}>
          <div className={"mt-4 p-[.875rem] rounded-[.9375rem] dash-block-3"}>
            <CopyableError message={state.error ?? 'Funding failed.'} />
          </div>
          {state.txid && (
            <div className={"mt-3"}>
              <HashField hash={state.txid} label={"L1 txid"} explorerUrl={network ? transactionUrl(state.txid, network) : null} />
            </div>
          )}
          {state.phase === AssetLockFundingPhase.Resumable && (
            <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"mt-2 block"}>
              The locked Dash is safe — you can return to this flow and resume the funding.
            </Text>
          )}
          <ModalActions primary={{ label: 'Close', onClick: onClose }} />
        </div>
      )}

      {isDone && state && (
        <div className={"phase-fade-in"} key={"done"}>
          <div className={"flex flex-col items-center text-center mt-5 mb-1"}>
            <div className={"success-pop"}>
              <SuccessIcon size={56} />
            </div>
            <Text size={16} weight={"extrabold"} color={"brand"} className={"mt-3"}>{texts.doneHeading}</Text>
            <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"mt-1"}>
              {texts.doneNote}
            </Text>
          </div>
          <div className={"mt-5 flex flex-col gap-[.75rem] p-[.875rem] rounded-[.9375rem] dash-block-3"}>
            {state.identityIdentifier ? (
              <div className={"flex justify-between items-center gap-4"}>
                <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"shrink-0"}>Identity</Text>
                <div className={"flex items-center gap-2 min-w-0"}>
                  <Text size={12} weight={"medium"} color={"brand"} className={"font-mono min-w-0 break-all text-right"}>{state.identityIdentifier}</Text>
                  <CopyButton text={state.identityIdentifier} className={"shrink-0"} />
                </div>
              </div>
            ) : (
              <div className={"flex justify-between items-center gap-4"}>
                <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"shrink-0"}>To</Text>
                <div className={"flex items-center gap-2 min-w-0"}>
                  <Text size={12} weight={"medium"} color={"brand"} className={"min-w-0 break-all select-all text-right"}>{state.toPlatformAddress}</Text>
                  {state.toPlatformAddress && <CopyButton text={state.toPlatformAddress} className={"shrink-0"} />}
                </div>
              </div>
            )}
            {doneTxid && <HashField hash={doneTxid} label={"L1 transaction hash"} explorerUrl={network ? transactionUrl(doneTxid, network) : null} />}
            {state.stHash && <HashField hash={state.stHash} label={"L2 state transition hash"} explorerUrl={network ? platformTransactionUrl(state.stHash, network) : null} />}
          </div>
          <ModalActions primary={{ label: 'Done', onClick: onClose }} />
        </div>
      )}
    </Modal>
  )
}
