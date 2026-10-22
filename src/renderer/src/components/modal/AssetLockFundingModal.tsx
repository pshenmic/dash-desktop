import { useEffect, useRef, useState } from 'react'
import { Text, SuccessIcon } from '../dash-ui-kit-enxtended'
import { API } from '@renderer/api'
import { AssetLockFundingState } from '@renderer/api/types'
import { AssetLockFundingPhase } from '@renderer/enums/AssetLockFundingPhase'
import { ModalSize } from '@renderer/enums/ModalSize'
import Modal from '@renderer/components/ui/Modal'
import ModalActions from '@renderer/components/ui/ModalActions'
import HashField from '@renderer/components/ui/HashField'
import PasswordField from '@renderer/components/ui/PasswordField'
import CopyButton from '@renderer/components/ui/CopyButton'
import TxSummary from '@renderer/components/ui/TxSummary'
import PhaseProgressList from '@renderer/components/ui/PhaseProgressList'
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
import { SEND_INPUTS_CHANGED_MESSAGE } from '@renderer/constants/sendConfirmModal'
import { SURFACE_SECTION } from '@renderer/constants/surfaces'
import { assetLockSummaryCosts, resumedAssetLockAmount } from '@renderer/utils/txSummaryCosts'
import { assetLockEndpoints } from '@renderer/utils/txSummaryEndpoints'
import { assetLockLockStep } from '@renderer/utils/assetLockFunding'
import type { AssetLockFundingModalProps } from '@renderer/types/AssetLockFundingModal'

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
  const [auto, setAuto] = useState(false)
  const autoStarted = useRef(false)
  const resuming = props.resume || resumeRequested
  const presetPassword = props.resume ? undefined : props.presetPassword

  useEffect(() => {
    if (!isOpen) {
      autoStarted.current = false
      return
    }
    if (autoStarted.current) return
    const preset = presetPassword || null
    setPassword('')
    setPreError(null)
    setBusy(preset !== null)
    setStarted(false)
    setState(null)
    setResumeRequested(false)
    setLockFallback(false)
    setAuto(preset !== null)
    notified.current = false
    pollingErrorNotified.current = false
    if (preset !== null) {
      autoStarted.current = true
      void begin(preset, true, false)
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

  const starting = auto && busy

  const begin = async (secret: string, preset: boolean, resume: boolean): Promise<void> => {
    try {
      if (!walletId || (!resume && !sourceValidRef.current)) {
        if (preset) {
          toast.error(SEND_INPUTS_CHANGED_MESSAGE)
          onClose()
        } else setBusy(false)
        return
      }
      const initial = resume || props.resume
        ? await API.resumeAssetLockFunding(walletId, secret)
        : await API.startAssetLockFunding(walletId, toPlatformAddress, props.amountDuffs, secret, kind, props.source)
      if (resume) setLockFallback(true)
      setState(initial)
      setStarted(true)
      setBusy(false)
    } catch (e) {
      console.error('Could not start asset lock funding', e)
      toast.error(getErrorMessage(e))
      if (preset) onClose()
      else setBusy(false)
    }
  }

  const handleConfirm = async (): Promise<void> => {
    if (!walletId || password.length === 0 || busy || started || (!resuming && !sourceValidRef.current)) return
    setBusy(true)
    setPreError(null)
    try {
      if (!await API.verifyWalletPassword(walletId, password)) {
        setPreError(INVALID_WALLET_PASSWORD_MESSAGE)
        setBusy(false)
        return
      }
    } catch (e) {
      console.error('Could not start asset lock funding', e)
      toast.error(getErrorMessage(e))
      setBusy(false)
      return
    }
    await begin(password, false, resuming)
  }

  const requestClose = (): void => {
    onClose()
  }

  const requestResume = (): void => {
    setAuto(false)
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

  const costs = resuming ? undefined : assetLockSummaryCosts(kind, props.amountDuffs, props.feeDuffs, props.feeCredits)
  const currentPhase = state ? phaseIndex(state.phase) : 0

  return (
    <Modal
      open={isOpen}
      onClose={requestClose}
      title={modalTitle}
      size={ModalSize.Lg}
      dismissible={!busy}
    >
      {!started && !starting && (
        <div className={"phase-fade-in"} key={"confirm"}>
          <TxSummary
            unit={"duffs"}
            amount={resuming ? resumedAssetLockAmount(kind, props.amountDuffs) : props.amountDuffs}
            from={from}
            to={assetLockEndpoints(kind, toPlatformAddress)}
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

      {(running || starting) && (
        <div className={"phase-fade-in"} key={"progress"}>
          <PhaseProgressList
            phases={phases.map((p, i) => p.key === AssetLockFundingPhase.WaitingChainLock
              ? { ...p, label: ASSET_LOCK_LOCK_STEP_LABELS[assetLockLockStep(state?.lockKind ?? null, i === currentPhase, lockFallback)] }
              : p)}
            current={currentPhase}
            className={"mt-5"}
          />
          {state?.txid && (
            <div className={"mt-3"}>
              <HashField hash={state.txid} label={"Core txid"} explorerUrl={network ? transactionUrl(state.txid, network) : null} />
            </div>
          )}
          {running && <ModalActions primary={{ label: 'Continue in background', onClick: onClose }} />}
        </div>
      )}

      {isError && state && (
        <div className={"phase-fade-in"} key={"error"}>
          {state.txid && (
            <div className={"mt-3"}>
              <HashField hash={state.txid} label={"Core txid"} explorerUrl={network ? transactionUrl(state.txid, network) : null} />
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
          <div className={`mt-5 flex flex-col gap-[.75rem] ${SURFACE_SECTION}`}>
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
            {doneTxid && <HashField hash={doneTxid} label={"Core transaction hash"} explorerUrl={network ? transactionUrl(doneTxid, network) : null} />}
            {state.stHash && <HashField hash={state.stHash} label={"Evo state transition hash"} explorerUrl={network ? platformTransactionUrl(state.stHash, network) : null} />}
          </div>
          <ModalActions primary={{ label: 'Done', onClick: onClose }} />
        </div>
      )}
    </Modal>
  )
}
