import { useEffect, useRef, useState } from 'react'
import { Text, SuccessIcon, CheckIcon } from '../dash-ui-kit-enxtended'
import { API } from '@renderer/api'
import { CoreRecipient, SendResult, TxLockStatus } from '@renderer/api/types'
import type { SendConfirmModalProps } from '@renderer/types/SendConfirmModal'
import { ConfirmModalPhase } from '@renderer/enums/ConfirmModalPhase'
import { ModalSize } from '@renderer/enums/ModalSize'
import { SendLockPhase } from '@renderer/enums/SendLockPhase'
import { davToDash } from '@renderer/utils/balance'
import { transactionUrl } from '@renderer/utils/explorer'
import Spinner from '@renderer/components/ui/Spinner'
import PasswordField from '@renderer/components/ui/PasswordField'
import Modal from '@renderer/components/ui/Modal'
import ModalActions from '@renderer/components/ui/ModalActions'
import HashField from '@renderer/components/ui/HashField'
import RecipientSummary from '@renderer/components/ui/RecipientSummary'
import TxSummary from '@renderer/components/ui/TxSummary'
import { TX_SUMMARY_LABELS } from '@renderer/constants/txSummary'
import { coreRecipientEndpoints } from '@renderer/utils/txSummaryEndpoints'
import { refreshTransactions } from '@renderer/hooks/useWalletTransactions'
import { INVALID_WALLET_PASSWORD_MESSAGE } from '@renderer/constants'
import { SEND_LOCK_PHASE_COPY } from '@renderer/constants/sendConfirmModal'

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
  onSuccess,
}: SendConfirmModalProps): React.JSX.Element {
  const sourceValidRef = useRef(sourceValid)
  sourceValidRef.current = sourceValid
  const amountDuffs = recipients.reduce((sum, recipient) => sum + recipient.amountDuffs, 0n)
  const [password, setPassword] = useState('')
  const [phase, setPhase] = useState<ConfirmModalPhase>(ConfirmModalPhase.Confirm)
  const [lockPhase, setLockPhase] = useState<SendLockPhase>(SendLockPhase.Waiting)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SendResult | null>(null)
  const [sentRecipients, setSentRecipients] = useState<CoreRecipient[]>([])

  useEffect(() => {
    if (isOpen) {
      setPassword('')
      setPhase(ConfirmModalPhase.Confirm)
      setLockPhase(SendLockPhase.Waiting)
      setError(null)
      setResult(null)
      setSentRecipients([])
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || phase !== ConfirmModalPhase.Done || !walletId || !result?.txid) return
    const txid = result.txid
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const startedAt = Date.now()
    const poll = async (): Promise<void> => {
      const status: TxLockStatus | null = await API.getTxLockStatus(walletId, txid).catch(() => null)
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
  let modalTitle = 'Confirm send'
  if (phase === ConfirmModalPhase.Done) {
    modalTitle = lockFinal ? 'Transaction confirmed' : 'Transaction sent'
  }

  const handleConfirm = async (): Promise<void> => {
    if (!walletId || password.length === 0 || sending || !sourceValidRef.current) return
    setPhase(ConfirmModalPhase.Sending)
    setError(null)
    try {
      const ok = await API.verifyWalletPassword(walletId, password)
      if (!ok) {
        setError(INVALID_WALLET_PASSWORD_MESSAGE)
        setPhase(ConfirmModalPhase.Confirm)
        return
      }
      if (!sourceValidRef.current) {
        setPhase(ConfirmModalPhase.Confirm)
        return
      }
      const submittedRecipients = recipients.map(recipient => ({ ...recipient }))
      setSentRecipients(submittedRecipients)
      const res = await API.sendTransaction(walletId, submittedRecipients, password, source, changeTo)
      setResult(res)
      setPhase(ConfirmModalPhase.Done)
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transaction failed')
      setPhase(ConfirmModalPhase.Confirm)
    }
  }

  // Prevent closing mid-broadcast — the tx is already in flight.
  const requestClose = (): void => {
    if (sending) return
    onClose()
  }

  return (
    <Modal open={isOpen} onClose={requestClose} title={modalTitle} size={ModalSize.Lg} dismissible={!sending}>
      {phase !== ConfirmModalPhase.Done ? (
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
            onChange={(value) => { setError(null); setPassword(value) }}
            onSubmit={handleConfirm}
            error={error}
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
              {result ? davToDash(result.amount) : ''} Dash sent
            </Text>
            <div className={"mt-2 flex items-center justify-center gap-2"}>
              {lockFinal
                ? <CheckIcon size={14} className={"shrink-0 text-dash-brand dark:text-dash-mint [&_circle]:hidden"} />
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

          <div className={"mt-5 flex flex-col gap-[.75rem] p-[.875rem] rounded-[.9375rem] dash-block-3"}>
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
