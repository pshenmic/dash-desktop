import { useEffect, useRef, useState } from 'react'
import { Text, SuccessIcon } from '../dash-ui-kit-enxtended'
import HashField from '@renderer/components/ui/HashField'
import PasswordField from '@renderer/components/ui/PasswordField'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import RecipientSummary from '@renderer/components/ui/RecipientSummary'
import TxSummary from '@renderer/components/ui/TxSummary'
import { toast } from '@renderer/components/ui/Toast'
import { useAuth } from '@renderer/contexts/AuthContext'
import { useErrorToast } from '@renderer/hooks/useErrorToast'
import { API } from '@renderer/api'
import { PlatformRecipient, ShieldedSpendState } from '@renderer/api/types'
import { platformTransactionUrl } from '@renderer/utils/explorer'
import { getErrorMessage } from '@renderer/utils/error'
import { ShieldedSpendPhase } from '@renderer/enums/ShieldedSpendPhase'
import { ModalSize } from '@renderer/enums/ModalSize'
import Modal from '@renderer/components/ui/Modal'
import ModalActions from '@renderer/components/ui/ModalActions'
import PhaseProgressList from '@renderer/components/ui/PhaseProgressList'
import { INVALID_WALLET_PASSWORD_MESSAGE, SHIELDED_SPEND_POLL_MS, SHIELDED_SPEND_RETRY_MS } from '@renderer/constants'
import { SHIELDED_SPEND_STEPS } from '@renderer/constants/shieldedProgress'
import { SHIELDED_SPEND_ESTIMATE_PREFIX } from '@renderer/constants/shieldedSpendModal'
import { SEND_INPUTS_CHANGED_MESSAGE } from '@renderer/constants/sendConfirmModal'
import { SURFACE_SECTION } from '@renderer/constants/surfaces'
import { shieldedSpendSummaryCosts } from '@renderer/utils/txSummaryCosts'
import { shieldedSpendEndpoints } from '@renderer/utils/txSummaryEndpoints'
import type { ShieldedSpendModalProps } from '@renderer/types/ShieldedSpendModal'

function phaseIndex(phase: ShieldedSpendPhase): number {
  return SHIELDED_SPEND_STEPS.findIndex(p => p.key === phase)
}


export default function ShieldedSpendModal({
  isOpen,
  advanced = true,
  onClose,
  walletId,
  title,
  kind,
  from,
  toValue,
  amountCredits,
  feeCredits,
  recipients,
  proverReady,
  start,
  sourceValid = true,
  onSuccess,
  successNote,
  presetPassword,
}: ShieldedSpendModalProps): React.JSX.Element {
  const sourceValidRef = useRef(sourceValid)
  sourceValidRef.current = sourceValid
  const { status } = useAuth()
  const network = status?.network ?? null
  const [password, setPassword] = useState('')
  const [preError, setPreError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [started, setStarted] = useState(false)
  const [spend, setSpend] = useState<ShieldedSpendState | null>(null)
  const [sentAmount, setSentAmount] = useState<bigint | null>(null)
  const [sentFee, setSentFee] = useState<bigint | null>(null)
  const [sentRecipients, setSentRecipients] = useState<PlatformRecipient[] | null>(null)
  const notified = useRef(false)
  const pollingErrorNotified = useRef(false)
  const [auto, setAuto] = useState(false)
  const autoStarted = useRef(false)

  useEffect(() => {
    if (!isOpen) {
      autoStarted.current = false
      return
    }
    if (autoStarted.current) return
    const preset = presetPassword && proverReady ? presetPassword : null
    setPassword('')
    setPreError(null)
    setBusy(preset !== null)
    setStarted(false)
    setSpend(null)
    setSentAmount(null)
    setSentFee(null)
    setSentRecipients(null)
    setAuto(preset !== null)
    notified.current = false
    pollingErrorNotified.current = false
    if (preset !== null) {
      autoStarted.current = true
      void begin(preset, true)
    }
  }, [isOpen])

  useEffect(() => {
    if (!started || !walletId) return
    let dead = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const poll = async (): Promise<void> => {
      try {
        const next = await API.getShieldedSpendState(walletId)
        if (dead) return
        pollingErrorNotified.current = false
        setSpend(next)
        if (next.phase === ShieldedSpendPhase.Done && !notified.current) {
          notified.current = true
          onSuccess()
        }
        if (next.phase !== ShieldedSpendPhase.Done && next.phase !== ShieldedSpendPhase.Error) {
          timer = setTimeout(() => { void poll() }, SHIELDED_SPEND_POLL_MS)
        }
      } catch (error) {
        console.error('Failed to refresh shielded spend state', error)
        if (!dead && !pollingErrorNotified.current) {
          pollingErrorNotified.current = true
          toast.error(getErrorMessage(error))
        }
        if (!dead) timer = setTimeout(() => { void poll() }, SHIELDED_SPEND_RETRY_MS)
      }
    }
    void poll()

    return () => {
      dead = true
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [started, walletId, onSuccess])

  const isError = started && spend?.phase === ShieldedSpendPhase.Error
  const error = isError ? spend?.error ?? 'Spend failed.' : null
  useErrorToast(error, isOpen)

  const running = started && spend != null && spend.phase !== ShieldedSpendPhase.Done && spend.phase !== ShieldedSpendPhase.Error
  const starting = auto && busy

  const begin = async (secret: string, preset: boolean): Promise<void> => {
    try {
      if (!sourceValidRef.current) {
        if (preset) {
          toast.error(SEND_INPUTS_CHANGED_MESSAGE)
          onClose()
        } else setBusy(false)
        return
      }
      setSentAmount(amountCredits)
      setSentFee(feeCredits)
      setSentRecipients(recipients?.map(recipient => ({ ...recipient })) ?? null)
      const initial = await start(secret)
      setSpend(initial)
      setStarted(true)
      setBusy(false)
    } catch (e) {
      console.error('Could not start shielded spend', e)
      toast.error(getErrorMessage(e))
      if (preset) onClose()
      else setBusy(false)
    }
  }

  const handleConfirm = async (): Promise<void> => {
    if (!walletId || password.length === 0 || busy || !proverReady || started || !sourceValidRef.current) return
    setBusy(true)
    setPreError(null)
    try {
      if (!await API.verifyWalletPassword(walletId, password)) {
        setPreError(INVALID_WALLET_PASSWORD_MESSAGE)
        setBusy(false)
        return
      }
    } catch (e) {
      console.error('Could not start shielded spend', e)
      toast.error(getErrorMessage(e))
      setBusy(false)
      return
    }
    await begin(password, false)
  }

  const retry = (): void => {
    setAuto(false)
    setStarted(false)
    setSpend(null)
    setPassword('')
    setPreError(null)
    notified.current = false
    pollingErrorNotified.current = false
  }

  const requestClose = (): void => {
    if (running || busy) return
    onClose()
  }

  const isDone = spend?.phase === ShieldedSpendPhase.Done
  const sentCredits = sentAmount ?? amountCredits
  const costs = shieldedSpendSummaryCosts(kind, amountCredits, feeCredits)
  const sentDetails = shieldedSpendSummaryCosts(kind, sentCredits, sentFee).details ?? []
  let confirmLabel = advanced ? 'Sign & Send' : 'Confirm'
  if (busy) confirmLabel = 'Starting…'
  else if (!proverReady) confirmLabel = 'Preparing…'
  let modalTitle = title
  if (isDone) modalTitle = spend?.identityId ? 'Identity created' : 'Sent privately'

  return (
    <Modal open={isOpen} onClose={requestClose} title={modalTitle} size={ModalSize.Lg} dismissible={!running && !busy}>
      {!started && !starting && (
        <div className={"phase-fade-in"} key={"confirm"}>
          <TxSummary
            unit={"credits"}
            amount={amountCredits}
            from={from}
            to={shieldedSpendEndpoints(kind, toValue, recipients)}
            fees={costs.fees}
            total={costs.total}
            details={costs.details}
            className={"mt-4"}
          />

          <PasswordField
            id={"shielded-spend-password"}
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
              disabled: password.length === 0 || !proverReady || !sourceValid,
              loading: busy,
            }}
          />
        </div>
      )}

      {(running || starting) && (
        <div className={"phase-fade-in"} key={"progress"}>
          <PhaseProgressList
            phases={SHIELDED_SPEND_STEPS.map(p => p.key === ShieldedSpendPhase.Syncing && spend?.phase === ShieldedSpendPhase.Syncing && spend.total > 0
              ? {
                  ...p,
                  extra: (
                    <div className={"flex flex-col gap-1"}>
                      <div className={"h-1 w-full overflow-hidden rounded-full bg-dash-primary-dark-blue/10 dark:bg-dash-mint/20"}>
                        <div className={"h-full rounded-full bg-dash-brand dark:bg-dash-mint transition-[width] duration-300"} style={{ width: `${Math.min(100, Math.round((spend.fetched / spend.total) * 100))}%` }} />
                      </div>
                      <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
                        {spend.fetched.toLocaleString('en-US')} / {spend.total.toLocaleString('en-US')}
                      </Text>
                    </div>
                  ),
                }
              : p)}
            current={spend ? phaseIndex(spend.phase) : 0}
            className={"mt-5"}
          />
        </div>
      )}

      {isError && (
        <div className={"phase-fade-in"} key={"error"}>
          <ModalActions
            secondary={{ label: 'Close', onClick: onClose }}
            primary={{ label: 'Try again', onClick: retry }}
          />
        </div>
      )}

      {isDone && (
        <div className={"phase-fade-in"} key={"done"}>
          <div className={"flex flex-col items-center text-center mt-5 mb-1"}>
            <div className={"success-pop"}><SuccessIcon size={56} /></div>
            <Text size={16} weight={"extrabold"} color={"brand"} className={"mt-3"}>
              <CreditsAmount credits={sentCredits} align={"center"} />
            </Text>
            {successNote && (
              <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"mt-1"}>
                {successNote}
              </Text>
            )}
          </div>
          <div className={`mt-5 flex flex-col gap-[.75rem] ${SURFACE_SECTION}`}>
            {sentRecipients && <RecipientSummary recipients={sentRecipients} />}
            {spend?.identityId && <HashField hash={spend.identityId} label={"Identity"} />}
            {sentDetails.map(line => line.amount !== null && (
              <div key={line.label} className={"flex justify-between items-center gap-4"}>
                <Text size={12} weight={"medium"} color={"brand"} opacity={50}>{line.label}</Text>
                <Text size={12} weight={"medium"} color={"brand"}><CreditsAmount credits={line.amount} prefix={SHIELDED_SPEND_ESTIMATE_PREFIX} align={"end"} /></Text>
              </div>
            ))}
            {spend?.stHash && <HashField hash={spend.stHash} explorerUrl={network ? platformTransactionUrl(spend.stHash, network) : null} />}
          </div>
          <ModalActions primary={{ label: 'Done', onClick: onClose }} />
        </div>
      )}
    </Modal>
  )
}
