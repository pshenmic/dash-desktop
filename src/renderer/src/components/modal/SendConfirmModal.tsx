import { useEffect, useRef, useState } from 'react'
import { Text, SuccessIcon, CheckIcon } from '../dash-ui-kit-extended'
import { API } from '@renderer/api'
import { CoreRecipient, SendResult, TxLockStatus } from '@renderer/api/types'
import type { SendConfirmModalProps } from '@renderer/types/SendConfirmModal'
import { ConfirmModalPhase } from '@renderer/enums/ConfirmModalPhase'
import { ModalSize } from '@renderer/enums/ModalSize'
import { SendLockPhase } from '@renderer/enums/SendLockPhase'
import { davToDash } from '@renderer/utils/balance'
import { getErrorMessage } from '@renderer/utils/error'
import { transactionUrl } from '@renderer/utils/explorer'
import Spinner from '@renderer/components/ui/Spinner'
import PasswordField from '@renderer/components/ui/PasswordField'
import PendingRow from '@renderer/components/ui/PendingRow'
import Modal from '@renderer/components/ui/Modal'
import ModalActions from '@renderer/components/ui/ModalActions'
import { toast } from '@renderer/components/ui/Toast'
import HashField from '@renderer/components/ui/HashField'
import RecipientSummary from '@renderer/components/ui/RecipientSummary'
import TxSummary from '@renderer/components/ui/TxSummary'
import { TX_SUMMARY_LABELS } from '@renderer/constants/txSummary'
import { coreRecipientEndpoints } from '@renderer/utils/txSummaryEndpoints'
import { refreshTransactions } from '@renderer/hooks/useWalletTransactions'
import { INVALID_WALLET_PASSWORD_MESSAGE } from '@renderer/constants'
import { SURFACE_SECTION } from '@renderer/constants/surfaces'
import { SEND_BROADCASTING_LABEL, SEND_INPUTS_CHANGED_MESSAGE, SEND_LOCK_PHASE_COPY, SEND_PROGRESS_TITLE } from '@renderer/constants/sendConfirmModal'

const LOCK_POLL_INTERVAL_MS = 2_000
const FALLBACK_POLL_INTERVAL_MS = 10_000
const INSTANT_LOCK_FALLBACK_MS = 15_000

export default function SendConfirmModal({
  isOpen,
  onClose,
  walletId,
  network,
  recipients,
  advanced = false,
  from,
  feeDuffs,
  source,
  changeTo,
  sourceValid = true,
  presetPassword,
  onSuccess,
}: SendConfirmModalProps): React.JSX.Element {
  const sourceValidRef = useRef(sourceValid)
  sourceValidRef.current = sourceValid
  const amountDuffs = recipients.reduce((sum, recipient) => sum + recipient.amountDuffs, 0n)
  const [password, setPassword] = useState('')
  const [phase, setPhase] = useState<ConfirmModalPhase>(ConfirmModalPhase.Confirm)
  const [lockPhase, setLockPhase] = useState<SendLockPhase>(SendLockPhase.Waiting)
  const [passwordInvalid, setPasswordInvalid] = useState(false)
  const [result, setResult] = useState<SendResult | null>(null)
  const [sentRecipients, setSentRecipients] = useState<CoreRecipient[]>([])
  const pollingErrorNotified = useRef(false)
  const [auto, setAuto] = useState(false)
  const autoStarted = useRef(false)
  const [seenOpen, setSeenOpen] = useState(false)

  if (isOpen !== seenOpen) {
    setSeenOpen(isOpen)
    if (isOpen) {
      setPassword('')
      setPhase(presetPassword ? ConfirmModalPhase.Sending : ConfirmModalPhase.Confirm)
      setLockPhase(SendLockPhase.Waiting)
      setPasswordInvalid(false)
      setResult(null)
      setSentRecipients([])
      setAuto(Boolean(presetPassword))
    }
  }

  const abort = (preset: boolean): void => {
    if (preset) onClose()
    else setPhase(ConfirmModalPhase.Confirm)
  }

  const submit = async (secret: string, preset: boolean): Promise<void> => {
    if (!walletId || !sourceValidRef.current) {
      if (preset) toast.error(SEND_INPUTS_CHANGED_MESSAGE)
      abort(preset)
      return
    }
    try {
      const submittedRecipients = recipients.map(recipient => ({ ...recipient }))
      setSentRecipients(submittedRecipients)
      const res = await API.sendTransaction(walletId, submittedRecipients, secret, source, changeTo)
      setResult(res)
      setPhase(ConfirmModalPhase.Done)
      onSuccess()
    } catch (e) {
      console.error('Transaction failed', e)
      toast.error(getErrorMessage(e))
      abort(preset)
    }
  }

  useEffect(() => {
    if (!isOpen) {
      autoStarted.current = false
      return
    }
    if (autoStarted.current) return
    pollingErrorNotified.current = false
    if (presetPassword) {
      autoStarted.current = true
      void submit(presetPassword, true)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || phase !== ConfirmModalPhase.Done || !walletId || !result?.txid) return
    const txid = result.txid
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const startedAt = Date.now()
    const poll = async (): Promise<void> => {
      let status: TxLockStatus | null = null
      try {
        status = await API.getTxLockStatus(walletId, txid)
        if (cancelled) return
        pollingErrorNotified.current = false
      } catch (error) {
        console.error('Failed to load transaction lock status', error)
        if (!cancelled && !pollingErrorNotified.current) {
          pollingErrorNotified.current = true
          toast.error(getErrorMessage(error))
        }
      }
      if (cancelled) return
      let final: SendLockPhase | null = null
      if (status?.instantLocked) final = SendLockPhase.Instant
      else if (status?.chainlocked) final = SendLockPhase.Chainlocked
      else if (status?.confirmed) final = SendLockPhase.Confirmed
      if (final) {
        setLockPhase(final)
        refreshTransactions(walletId)
        return
      }
      const fallback = Date.now() - startedAt >= INSTANT_LOCK_FALLBACK_MS
      if (fallback) setLockPhase(SendLockPhase.Fallback)
      timer = setTimeout(poll, fallback ? FALLBACK_POLL_INTERVAL_MS : LOCK_POLL_INTERVAL_MS)
    }
    poll()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [isOpen, phase, walletId, result?.txid])

  const sending = phase === ConfirmModalPhase.Sending
  const lockFinal = lockPhase !== SendLockPhase.Waiting && lockPhase !== SendLockPhase.Fallback
  let modalTitle = auto ? SEND_PROGRESS_TITLE : 'Confirm send'
  if (phase === ConfirmModalPhase.Done) {
    modalTitle = lockFinal ? 'Transaction confirmed' : 'Transaction sent'
  }

  const handleConfirm = async (): Promise<void> => {
    if (!walletId || password.length === 0 || sending || !sourceValidRef.current) return
    setPhase(ConfirmModalPhase.Sending)
    setPasswordInvalid(false)
    try {
      if (await API.verifyWalletPassword(walletId, password)) {
        await submit(password, false)
        return
      }
      setPasswordInvalid(true)
    } catch (e) {
      console.error('Transaction failed', e)
      toast.error(getErrorMessage(e))
    }
    setPhase(ConfirmModalPhase.Confirm)
  }

  // Prevent closing mid-broadcast — the tx is already in flight.
  const requestClose = (): void => {
    if (sending) return
    onClose()
  }

  return (
    <Modal open={isOpen} onClose={requestClose} title={modalTitle} size={ModalSize.Lg} dismissible={!sending}>
      {phase !== ConfirmModalPhase.Done ? auto ? (
        <div className={"phase-fade-in"} key={"pending"}>
          <PendingRow label={SEND_BROADCASTING_LABEL} className={"mt-5"} />
        </div>
      ) : (
        <div className={"phase-fade-in"} key={"confirm"}>
          <TxSummary
            unit={"duffs"}
            amount={amountDuffs}
            from={from}
            to={coreRecipientEndpoints(recipients)}
            fees={[{ label: TX_SUMMARY_LABELS.networkFee, amount: feeDuffs ?? null, unit: 'duffs' }]}
            total={feeDuffs == null ? null : amountDuffs + feeDuffs}
            className={"mt-5"}
          />

          <PasswordField
            id={"send-password"}
            value={password}
            onChange={(value) => { setPasswordInvalid(false); setPassword(value) }}
            onSubmit={handleConfirm}
            error={passwordInvalid ? INVALID_WALLET_PASSWORD_MESSAGE : null}
            disabled={sending}
            className={"mt-5"}
          />

          <ModalActions
            secondary={{ label: 'Cancel', onClick: requestClose, disabled: sending }}
            primary={{
              label: sending ? 'Sending…' : advanced ? 'Sign & Send' : 'Confirm',
              onClick: handleConfirm,
              disabled: password.length === 0 || !sourceValid,
              loading: sending,
            }}
          />
        </div>
      ) : (
        <div className={"phase-fade-in"} key={"done"}>
          <div className={"flex flex-col items-center text-center mt-5 mb-1"}>
            <div className={"success-pop"}>
              <SuccessIcon size={56} />
            </div>
            <Text size={16} weight={"extrabold"} color={"brand"} className={"mt-3"}>
              {result ? davToDash(result.amount) : ''}<span className="font-normal"> Dash</span> sent
            </Text>
            <div className={"mt-2 flex items-center justify-center gap-2"}>
              {lockFinal
                ? <CheckIcon size={14} color={"currentColor"} className={"shrink-0 text-dash-brand dark:text-dash-mint [&_circle]:hidden"} />
                : <Spinner size={14} />}
              <Text
                size={12}
                weight={"medium"}
                color={lockFinal ? 'blue-mint' : 'brand'}
                opacity={lockFinal ? 100 : 50}
              >
                {SEND_LOCK_PHASE_COPY[lockPhase]}
              </Text>
            </div>
          </div>

          <div className={`mt-5 flex flex-col gap-[.75rem] ${SURFACE_SECTION}`}>
            <RecipientSummary recipients={sentRecipients} />
            <div className={"flex justify-between items-center gap-4"}>
              <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Network fee</Text>
              <Text size={12} weight={"medium"} color={"brand"}>{result ? davToDash(result.fee) : ''} Dash</Text>
            </div>
            {result?.txid && (
              <HashField
                hash={result.txid}
                label={"Transaction ID"}
                explorerUrl={network ? transactionUrl(result.txid, network) : null}
              />
            )}
          </div>

          <ModalActions primary={{ label: 'Done', onClick: onClose }} />
        </div>
      )}
    </Modal>
  )
}
