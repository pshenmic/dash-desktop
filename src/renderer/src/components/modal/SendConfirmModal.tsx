import { useEffect, useRef, useState } from 'react'
import { Input, Text, SuccessIcon, CheckIcon } from '../dash-ui-kit-enxtended'
import { API } from '@renderer/api'
import { CoreRecipient, SendResult, TxLockStatus } from '@renderer/api/types'
import type { SendConfirmModalProps } from '@renderer/types/SendConfirmModal'
import { ConfirmModalPhase } from '@renderer/enums/ConfirmModalPhase'
import { ModalSize } from '@renderer/enums/ModalSize'
import { SendLockPhase } from '@renderer/enums/SendLockPhase'
import { davToDash } from '@renderer/utils/balance'
import { transactionUrl } from '@renderer/utils/explorer'
import Spinner from '@renderer/components/ui/Spinner'
import CopyableError from '@renderer/components/ui/CopyableError'
import Modal from '@renderer/components/ui/Modal'
import ModalActions from '@renderer/components/ui/ModalActions'
import HashField from '@renderer/components/ui/HashField'
import RecipientSummary from '@renderer/components/ui/RecipientSummary'
import { refreshTransactions } from '@renderer/hooks/useWalletTransactions'
import { INVALID_WALLET_PASSWORD_MESSAGE } from '@renderer/constants'

const LOCK_POLL_INTERVAL_MS = 2_000
const FALLBACK_POLL_INTERVAL_MS = 10_000
const INSTANT_LOCK_FALLBACK_MS = 15_000

const LOCK_PHASE_COPY: Record<SendLockPhase, string> = {
  [SendLockPhase.Waiting]: 'Waiting for InstantSend confirmation…',
  [SendLockPhase.Fallback]: 'No InstantSend lock yet — waiting for block confirmation (ChainLock). This can take a few minutes; you can close this window, the transaction list will update.',
  [SendLockPhase.Instant]: 'Confirmed by InstantSend — the payment is final.',
  [SendLockPhase.Chainlocked]: 'Confirmed by ChainLock — the payment is final.',
  [SendLockPhase.Confirmed]: 'Confirmed in a block.',
}

export default function SendConfirmModal({
  isOpen,
  onClose,
  walletId,
  network,
  recipients,
  advanced = false,
  amountFiat,
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
          <div className="mt-5 flex flex-col gap-4 rounded-2xl p-4 dash-block-3">
            <div className="grid grid-cols-[8rem_minmax(0,1fr)] items-baseline gap-4">
              <Text size={14} weight="medium" color="brand" opacity={50}>Sending</Text>
              <div className="min-w-0 flex flex-col items-end gap-1 text-right">
                <Text size={24} weight="extrabold" color="brand" className="break-words">
                  {davToDash(amountDuffs)} <span className="text-sm font-medium">Dash</span>
                </Text>
                {amountFiat && <Text size={12} weight="medium" color="brand" opacity={50}>≈ {amountFiat}</Text>}
              </div>
            </div>
            {!advanced && <RecipientSummary recipients={recipients} />}
            {feeDuffs != null && (
              <div className="flex flex-col gap-3 border-t border-dash-primary-dark-blue/10 pt-3 dark:border-white/10">
                <div className="grid grid-cols-[8rem_minmax(0,1fr)] items-baseline gap-4">
                  <Text size={14} weight="medium" color="brand" opacity={50}>Network fee (est.)</Text>
                  <Text size={12} weight="medium" color="brand" className="text-right">{davToDash(feeDuffs)} Dash</Text>
                </div>
                <div className="grid grid-cols-[8rem_minmax(0,1fr)] items-baseline gap-4">
                  <Text size={14} weight="medium" color="brand" opacity={50}>Total</Text>
                  <Text size={14} weight="extrabold" color="brand" className="text-right">{davToDash(amountDuffs + feeDuffs)} Dash</Text>
                </div>
              </div>
            )}
          </div>

          <div className={"mt-5"}>
            <Input
              id={"send-password"}
              type={"password"}
              placeholder={"Wallet password"}
              aria-label="Wallet password"
              value={password}
              variant={"outlined"}
              onChange={(e) => { setError(null); setPassword(e.target.value) }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm() }}
              className={"h-14.25 rounded-[1.25rem] bg-transparent!"}
              colorScheme={error ? 'error' : 'primary'}
              disabled={sending}
              autoFocus
            />
          </div>
          <div
            className={`
              overflow-hidden transition-all duration-200
              ${error ? 'max-h-40 opacity-100 mt-2' : 'max-h-0 opacity-0'}
            `}
          >
            <CopyableError message={error ?? ''} />
          </div>

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
                {LOCK_PHASE_COPY[lockPhase]}
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
