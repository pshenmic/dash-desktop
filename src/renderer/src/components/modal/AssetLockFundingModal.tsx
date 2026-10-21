import { useEffect, useRef, useState } from 'react'
import { Text, SuccessIcon, CheckIcon } from '../dash-ui-kit-enxtended'
import { API } from '@renderer/api'
import { AssetLockFundingKind, AssetLockFundingState } from '@renderer/api/types'
import { AssetLockFundingPhase } from '@renderer/enums/AssetLockFundingPhase'
import { ModalSize } from '@renderer/enums/ModalSize'
import Spinner from '@renderer/components/ui/Spinner'
import Modal from '@renderer/components/ui/Modal'
import ModalActions from '@renderer/components/ui/ModalActions'
import HashField from '@renderer/components/ui/HashField'
import PasswordField from '@renderer/components/ui/PasswordField'
import CopyButton from '@renderer/components/ui/CopyButton'
import TxSummary from '@renderer/components/ui/TxSummary'
import { toast } from '@renderer/components/ui/Toast'
import { useAuth } from '@renderer/contexts/AuthContext'
import { useErrorToast } from '@renderer/hooks/useErrorToast'
import { getErrorMessage } from '@renderer/utils/error'
import { transactionUrl, platformTransactionUrl } from '@renderer/utils/explorer'
import { ASSET_LOCK_FUNDING_POLL_MS, INVALID_WALLET_PASSWORD_MESSAGE } from '@renderer/constants'
import {
  ASSET_LOCK_FUNDING_TEXTS,
  ASSET_LOCK_INSTANT_LOCK_FALLBACK_MS,
  ASSET_LOCK_LOCK_STEP_LABELS,
  ASSET_LOCK_PHASE_LABELS,
} from '@renderer/constants/assetLockFunding'
import { TxEndpointKind } from '@renderer/enums/TxEndpointKind'
import { assetLockSummaryCosts, resumedAssetLockAmount } from '@renderer/utils/txSummaryCosts'
import { assetLockLockStep } from '@renderer/utils/assetLockFunding'
import type { AssetLockFundingModalProps } from '@renderer/types/AssetLockFundingModal'
import type { TxSummaryEndpoint } from '@renderer/types/TxSummary'

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
  const [resumeRequested, setResumeRequested] = useState(false)
  const [lockFallback, setLockFallback] = useState(false)
  const notified = useRef(false)
  const pollingErrorNotified = useRef(false)
  const resuming = props.resume || resumeRequested

  useEffect(() => {
    if (isOpen) {
      setPassword('')
      setPreError(null)
      setBusy(false)
      setStarted(false)
      setState(null)
      setResumeRequested(false)
      setLockFallback(false)
      notified.current = false
      pollingErrorNotified.current = false
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
      .catch(error => {
        if (dead) return
        console.error('Failed to load asset lock funding state', error)
        toast.error(getErrorMessage(error))
      })

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
        pollingErrorNotified.current = false
        setState(next)
        if (next.phase === AssetLockFundingPhase.Done && !notified.current) {
          notified.current = true
          onSuccess()
        }
        if (next.phase !== AssetLockFundingPhase.Done && next.phase !== AssetLockFundingPhase.Error && next.phase !== AssetLockFundingPhase.Resumable) {
          timer = setTimeout(() => { void poll() }, ASSET_LOCK_FUNDING_POLL_MS)
        }
      } catch (error) {
        console.error('Failed to refresh asset lock funding state', error)
        if (!dead && !pollingErrorNotified.current) {
          pollingErrorNotified.current = true
          toast.error(getErrorMessage(error))
        }
        if (!dead) timer = setTimeout(() => { void poll() }, ASSET_LOCK_FUNDING_POLL_MS)
      }
    }
    void poll()

    return () => {
      dead = true
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [started, walletId, onSuccess])

  const isError = started && (state?.phase === AssetLockFundingPhase.Error || state?.phase === AssetLockFundingPhase.Resumable)
  const error = isError ? state?.error ?? 'Funding failed.' : null
  useErrorToast(error, isOpen)

  const running = started && state != null && state.phase !== AssetLockFundingPhase.Done && state.phase !== AssetLockFundingPhase.Error && state.phase !== AssetLockFundingPhase.Resumable
  const awaitingLock = running && state?.phase === AssetLockFundingPhase.WaitingChainLock && state.lockKind == null

  useEffect(() => {
    if (!awaitingLock) return
    const timer = setTimeout(() => setLockFallback(true), ASSET_LOCK_INSTANT_LOCK_FALLBACK_MS)
    return () => clearTimeout(timer)
  }, [awaitingLock])

  const handleConfirm = async (): Promise<void> => {
    if (!walletId || password.length === 0 || busy || started || (!resuming && !sourceValidRef.current)) return
    setBusy(true)
    setPreError(null)
    try {
      const ok = await API.verifyWalletPassword(walletId, password)
      if (!ok) {
        setPreError(INVALID_WALLET_PASSWORD_MESSAGE)
        setBusy(false)
        return
      }
      if (!resuming && !sourceValidRef.current) {
        setBusy(false)
        return
      }
      const initial = resuming
        ? await API.resumeAssetLockFunding(walletId, password)
        : await API.startAssetLockFunding(walletId, toPlatformAddress, props.amountDuffs, password, kind, props.source)
      if (resuming) setLockFallback(true)
      setState(initial)
      setStarted(true)
      setBusy(false)
    } catch (e) {
      console.error('Could not start asset lock funding', e)
      toast.error(getErrorMessage(e))
      setBusy(false)
    }
  }

  const requestClose = (): void => {
    onClose()
  }

  const requestResume = (): void => {
    setPassword('')
    setPreError(null)
    setResumeRequested(true)
    setStarted(false)
  }

  const isDone = started && state?.phase === AssetLockFundingPhase.Done
  const doneTxid = state?.txid ?? null
  const texts = ASSET_LOCK_FUNDING_TEXTS[kind]
  const phases = ASSET_LOCK_PHASE_LABELS[kind]
  let modalTitle = texts.title
  if (isDone) modalTitle = texts.doneTitle
  else if (resuming) modalTitle = texts.resumeTitle
  let confirmLabel = advanced ? texts.confirm : 'Confirm'
  if (busy) confirmLabel = 'Starting…'
  else if (resuming) confirmLabel = 'Resume'

  const to: TxSummaryEndpoint[] = []
  if (toPlatformAddress) to.push({ value: toPlatformAddress, kind: kind === AssetLockFundingKind.Shielded ? TxEndpointKind.Shielded : TxEndpointKind.Address })
  else if (texts.emptyTo) to.push({ value: texts.emptyTo, kind: TxEndpointKind.Label })

  const costs = resuming ? undefined : assetLockSummaryCosts(kind, props.amountDuffs, props.feeDuffs, props.feeCredits)

  return (
    <Modal
      open={isOpen}
      onClose={requestClose}
      title={modalTitle}
      size={ModalSize.Lg}
    >
      {!started && (
        <div className={"phase-fade-in"} key={"confirm"}>
          <TxSummary
            unit={"duffs"}
            amount={resuming ? resumedAssetLockAmount(kind, props.amountDuffs) : props.amountDuffs}
            from={from}
            to={to}
            fees={costs?.fees}
            total={costs?.total}
            details={costs?.details}
            className={"mt-4"}
          />

          <PasswordField
            id={"asset-lock-password"}
            value={password}
            onChange={(value) => { setPreError(null); setPassword(value) }}
            onSubmit={handleConfirm}
            error={preError}
            disabled={busy}
            className={"mt-5"}
          />

          <ModalActions
            secondary={{ label: 'Cancel', onClick: requestClose, disabled: busy }}
            primary={{
              label: confirmLabel,
              onClick: handleConfirm,
              disabled: password.length === 0 || (!resuming && !sourceValid),
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
              const label = p.key === AssetLockFundingPhase.WaitingChainLock
                ? ASSET_LOCK_LOCK_STEP_LABELS[assetLockLockStep(state.lockKind, active, lockFallback)]
                : p.label
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
          <ModalActions primary={{ label: 'Continue in background', onClick: onClose }} />
        </div>
      )}

      {isError && state && (
        <div className={"phase-fade-in"} key={"error"}>
          {state.txid && (
            <div className={"mt-3"}>
              <HashField hash={state.txid} label={"L1 txid"} explorerUrl={network ? transactionUrl(state.txid, network) : null} />
            </div>
          )}
          {state.phase === AssetLockFundingPhase.Resumable ? (
            <>
              <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"mt-2 block"}>
                Your Dash is safe.
              </Text>
              <ModalActions
                secondary={{ label: 'Close', onClick: onClose }}
                primary={{ label: 'Resume', onClick: requestResume }}
              />
            </>
          ) : (
            <ModalActions primary={{ label: 'Close', onClick: onClose }} />
          )}
        </div>
      )}

      {isDone && state && (
        <div className={"phase-fade-in"} key={"done"}>
          <div className={"flex flex-col items-center text-center mt-5 mb-1"}>
            <div className={"success-pop"}>
              <SuccessIcon size={56} />
            </div>
            <Text size={16} weight={"extrabold"} color={"brand"} className={"mt-3"}>{texts.doneHeading}</Text>
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
