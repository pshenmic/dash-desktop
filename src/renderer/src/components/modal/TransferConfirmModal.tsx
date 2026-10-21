import { useEffect, useRef, useState } from 'react'
import { Input, Text, SuccessIcon } from '../dash-ui-kit-enxtended'
import { ExclamationIcon } from '../dash-ui-kit-enxtended/icons'
import { useAuth } from '@renderer/contexts/AuthContext'
import { PlatformSendResult } from '@renderer/api/types'
import { ConfirmModalPhase } from '@renderer/enums/ConfirmModalPhase'
import { ModalSize } from '@renderer/enums/ModalSize'
import { platformTransactionUrl } from '@renderer/utils/explorer'
import Modal from '@renderer/components/ui/Modal'
import ModalActions from '@renderer/components/ui/ModalActions'
import CopyableError from '@renderer/components/ui/CopyableError'
import HashField from '@renderer/components/ui/HashField'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import RecipientSummary from '@renderer/components/ui/RecipientSummary'
import TxSummary from '@renderer/components/ui/TxSummary'
import type { RecipientSummaryProps } from '@renderer/types/RecipientSummary'
import type { TransferConfirmModalProps } from '@renderer/types/TransferConfirmModal'
import { API } from '@renderer/api'
import { INVALID_WALLET_PASSWORD_MESSAGE } from '@renderer/constants'

export default function TransferConfirmModal({
  isOpen,
  advanced = true,
  onClose,
  title,
  successTitle,
  summary,
  recipients,
  feeOutputIndex,
  feeCredits,
  run,
  sourceValid = true,
  onSuccess,
  successNote,
}: TransferConfirmModalProps): React.JSX.Element {
  const sourceValidRef = useRef(sourceValid)
  sourceValidRef.current = sourceValid
  const { status } = useAuth()
  const network = status?.network ?? null
  const walletId = status?.selectedWalletId ?? null
  const [password, setPassword] = useState('')
  const [phase, setPhase] = useState<ConfirmModalPhase>(ConfirmModalPhase.Confirm)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PlatformSendResult | null>(null)
  const [sentRecipients, setSentRecipients] = useState<RecipientSummaryProps | null>(null)

  useEffect(() => {
    if (isOpen) {
      setPassword('')
      setPhase(ConfirmModalPhase.Confirm)
      setError(null)
      setResult(null)
      setSentRecipients(null)
    }
  }, [isOpen])

  const sending = phase === ConfirmModalPhase.Sending

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
      setSentRecipients(recipients ? {
        recipients: recipients.map(recipient => ({ ...recipient })),
        feeOutputIndex,
        feeCredits,
      } : null)
      const res = await run(password)
      setResult(res)
      setPhase(ConfirmModalPhase.Done)
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transfer failed')
      setPhase(ConfirmModalPhase.Confirm)
    }
  }

  const requestClose = (): void => {
    if (sending) return
    onClose()
  }

  return (
    <Modal
      open={isOpen}
      onClose={requestClose}
      title={phase === ConfirmModalPhase.Done ? successTitle : title}
      size={ModalSize.Lg}
      dismissible={!sending}
    >
      {phase !== ConfirmModalPhase.Done ? (
        <div className={"phase-fade-in"} key={"confirm"}>
          <TxSummary {...summary} className={"mt-4"} />

          <Text size={14} weight={"medium"} color={"brand"} opacity={40} className={"mt-4 block"}>
            Enter your wallet password to sign and broadcast.
          </Text>
          <div className={"mt-2"}>
            <Input
              id={"transfer-confirm-password"}
              type={"password"}
              placeholder={"Wallet password"}
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
              {result ? <CreditsAmount credits={result.amountCredits} align={"center"} /> : ''}
            </Text>
            {sentRecipients?.feeOutputIndex !== undefined && (
              <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"mt-1"}>
                Total debited, including the fee deducted from a recipient.
              </Text>
            )}
            <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"mt-1"}>
              Broadcast to Platform. It will confirm shortly.
            </Text>
            {successNote && (
              <div className={"mt-3 flex items-start gap-2 w-full p-[.875rem] rounded-[.9375rem] border border-dash-orange/40 bg-dash-orange/8 dark:bg-dash-orange/10 text-left"}>
                <ExclamationIcon size={16} className={"text-dash-orange shrink-0"} />
                <Text size={12} weight={"medium"} className={"leading-[130%] text-dash-orange!"}>
                  {successNote}
                </Text>
              </div>
            )}
          </div>

          <div className={"mt-5 flex flex-col gap-[.75rem] p-[.875rem] rounded-[.9375rem] dash-block-3"}>
            <div className={"flex justify-between items-center gap-4"}>
              <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"shrink-0"}>From</Text>
              <Text size={12} weight={"medium"} color={"brand"} className={"min-w-0 break-all select-all text-right"}>{result?.fromAddress}</Text>
            </div>
            {sentRecipients ? <RecipientSummary {...sentRecipients} feeCredits={result?.feeCredits ?? sentRecipients.feeCredits} /> : <div className={"flex justify-between items-center gap-4"}>
              <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"shrink-0"}>To</Text>
              <Text size={12} weight={"medium"} color={"brand"} className={"min-w-0 break-all select-all text-right"}>{result?.toAddress}</Text>
            </div>}
            {result?.feeCredits != null && (
              <div className={"flex justify-between items-center gap-4"}>
                <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
                  {sentRecipients?.feeOutputIndex === undefined ? 'Reserved for fee' : `Fee reserve from recipient ${sentRecipients.feeOutputIndex + 1}`}
                </Text>
                <Text size={12} weight={"medium"} color={"brand"}><CreditsAmount credits={result.feeCredits} align={"end"} /></Text>
              </div>
            )}
            {result?.stHash && <HashField hash={result.stHash} explorerUrl={network ? platformTransactionUrl(result.stHash, network) : null} />}
          </div>

          <ModalActions primary={{ label: 'Done', onClick: onClose }} />
        </div>
      )}
    </Modal>
  )
}
