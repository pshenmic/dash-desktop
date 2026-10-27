import { useEffect, useRef, useState } from 'react'
import { Text, SuccessIcon } from '../dash-ui-kit-extended'
import { useAuth } from '@renderer/contexts/AuthContext'
import { API } from '@renderer/api'
import { ShieldResult } from '@renderer/api/types'
import type { ShieldConfirmModalProps } from '@renderer/types/ShieldConfirmModal'
import { getErrorMessage } from '@renderer/utils/error'
import { platformTransactionUrl } from '@renderer/utils/explorer'
import { ConfirmModalPhase } from '@renderer/enums/ConfirmModalPhase'
import { ModalSize } from '@renderer/enums/ModalSize'
import PasswordField from '@renderer/components/ui/PasswordField'
import PendingRow from '@renderer/components/ui/PendingRow'
import Modal from '@renderer/components/ui/Modal'
import ModalActions from '@renderer/components/ui/ModalActions'
import { toast } from '@renderer/components/ui/Toast'
import HashField from '@renderer/components/ui/HashField'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import TxSummary from '@renderer/components/ui/TxSummary'
import { TxEndpointKind } from '@renderer/enums/TxEndpointKind'
import { TX_SUMMARY_LABELS } from '@renderer/constants/txSummary'
import { INVALID_WALLET_PASSWORD_MESSAGE } from '@renderer/constants'
import { SURFACE_SECTION } from '@renderer/constants/surfaces'
import { SEND_INPUTS_CHANGED_MESSAGE, SHIELD_PROGRESS_TITLE, SHIELD_PROVING_PENDING_LABEL } from '@renderer/constants/sendConfirmModal'

export default function ShieldConfirmModal({
  isOpen,
  advanced = true,
  onClose,
  walletId,
  source,
  from,
  toAddress,
  amountCredits,
  feeCredits,
  totalCredits,
  proverReady,
  sourceValid = true,
  presetPassword,
  onSuccess,
}: ShieldConfirmModalProps): React.JSX.Element {
  const sourceValidRef = useRef(sourceValid)
  sourceValidRef.current = sourceValid
  const { status } = useAuth()
  const network = status?.network ?? null
  const [password, setPassword] = useState('')
  const [phase, setPhase] = useState<ConfirmModalPhase>(ConfirmModalPhase.Confirm)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ShieldResult | null>(null)
  const [auto, setAuto] = useState(false)
  const autoStarted = useRef(false)
  const [seenOpen, setSeenOpen] = useState(false)
  const autoPassword = proverReady ? presetPassword : undefined

  if (isOpen !== seenOpen) {
    setSeenOpen(isOpen)
    if (isOpen) {
      setPassword('')
      setPhase(autoPassword ? ConfirmModalPhase.Sending : ConfirmModalPhase.Confirm)
      setError(null)
      setResult(null)
      setAuto(Boolean(autoPassword))
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
      const res = await API.shieldToPool(walletId, source, toAddress, amountCredits, secret)
      setResult(res)
      setPhase(ConfirmModalPhase.Done)
      onSuccess()
    } catch (e) {
      console.error('Shield failed', e)
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
    if (autoPassword) {
      autoStarted.current = true
      void submit(autoPassword, true)
    }
  }, [isOpen])

  const shielding = phase === ConfirmModalPhase.Sending

  const handleConfirm = async (): Promise<void> => {
    if (!walletId || password.length === 0 || shielding || !proverReady || !sourceValidRef.current) return
    setPhase(ConfirmModalPhase.Sending)
    setError(null)
    try {
      if (await API.verifyWalletPassword(walletId, password)) {
        await submit(password, false)
        return
      }
      setError(INVALID_WALLET_PASSWORD_MESSAGE)
    } catch (e) {
      console.error('Shield failed', e)
      toast.error(getErrorMessage(e))
    }
    setPhase(ConfirmModalPhase.Confirm)
  }

  const requestClose = (): void => {
    if (shielding) return
    onClose()
  }

  let confirmLabel = advanced ? 'Sign & Send' : 'Confirm'
  if (shielding) confirmLabel = 'Shielding…'
  else if (!proverReady) confirmLabel = 'Preparing…'

  let modalTitle = auto ? SHIELD_PROGRESS_TITLE : 'Confirm shield'
  if (phase === ConfirmModalPhase.Done) modalTitle = 'Funds shielded'

  return (
    <Modal
      open={isOpen}
      onClose={requestClose}
      title={modalTitle}
      size={ModalSize.Lg}
      dismissible={!shielding}
    >
      {phase !== ConfirmModalPhase.Done ? auto ? (
        <div className={"phase-fade-in"} key={"pending"}>
          <PendingRow label={SHIELD_PROVING_PENDING_LABEL} className={"mt-4"} />
        </div>
      ) : (
        <div className={"phase-fade-in"} key={"confirm"}>
          <TxSummary
            unit={"credits"}
            amount={amountCredits}
            from={from}
            to={[{ value: toAddress, kind: TxEndpointKind.Shielded }]}
            fees={[{ label: TX_SUMMARY_LABELS.reservedFee, amount: feeCredits, unit: 'credits' }]}
            total={totalCredits}
            className={"mt-4"}
          />

          {shielding ? (
            <PendingRow label={SHIELD_PROVING_PENDING_LABEL} className={"mt-4"} />
          ) : (
            <PasswordField
              id={"shield-password"}
              value={password}
              onChange={(value) => { setError(null); setPassword(value) }}
              onSubmit={handleConfirm}
              error={error}
              className={"mt-4"}
            />
          )}

          <ModalActions
            secondary={{ label: 'Cancel', onClick: requestClose, disabled: shielding }}
            primary={{
              label: confirmLabel,
              onClick: handleConfirm,
              disabled: password.length === 0 || !proverReady || !sourceValid,
              loading: shielding,
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
              {result && <CreditsAmount credits={result.amountCredits} align={"center"} />}
            </Text>
          </div>

          <div className={`mt-5 flex flex-col gap-[.75rem] ${SURFACE_SECTION}`}>
            <div className={"flex justify-between items-center gap-4"}>
              <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"shrink-0"}>Fee-paying address</Text>
              <Text size={12} weight={"medium"} color={"brand"} className={"min-w-0 break-all select-all text-right"}>{result?.fromAddress}</Text>
            </div>
            {result?.stHash && <HashField hash={result.stHash} explorerUrl={network ? platformTransactionUrl(result.stHash, network) : null} />}
          </div>

          <ModalActions primary={{ label: 'Done', onClick: onClose }} />
        </div>
      )}
    </Modal>
  )
}
