import { useEffect, useRef, useState } from 'react'
import { Text, SuccessIcon } from '../dash-ui-kit-enxtended'
import { useAuth } from '@renderer/contexts/AuthContext'
import { API } from '@renderer/api'
import { ShieldResult } from '@renderer/api/types'
import type { ShieldConfirmModalProps } from '@renderer/types/ShieldConfirmModal'
import { getErrorMessage } from '@renderer/utils/error'
import { platformTransactionUrl } from '@renderer/utils/explorer'
import { ConfirmModalPhase } from '@renderer/enums/ConfirmModalPhase'
import { ModalSize } from '@renderer/enums/ModalSize'
import Spinner from '@renderer/components/ui/Spinner'
import PasswordField from '@renderer/components/ui/PasswordField'
import Modal from '@renderer/components/ui/Modal'
import ModalActions from '@renderer/components/ui/ModalActions'
import { toast } from '@renderer/components/ui/Toast'
import HashField from '@renderer/components/ui/HashField'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import TxSummary from '@renderer/components/ui/TxSummary'
import { TxEndpointKind } from '@renderer/enums/TxEndpointKind'
import { TX_SUMMARY_LABELS } from '@renderer/constants/txSummary'
import { SHIELDED_PROVING_LABEL } from '@renderer/constants/shieldedProgress'
import { INVALID_WALLET_PASSWORD_MESSAGE } from '@renderer/constants'

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

  useEffect(() => {
    if (isOpen) {
      setPassword('')
      setPhase(ConfirmModalPhase.Confirm)
      setError(null)
      setResult(null)
    }
  }, [isOpen])

  const shielding = phase === ConfirmModalPhase.Sending

  const handleConfirm = async (): Promise<void> => {
    if (!walletId || password.length === 0 || shielding || !proverReady || !sourceValidRef.current) return
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
      const res = await API.shieldToPool(walletId, source, toAddress, amountCredits, password)
      setResult(res)
      setPhase(ConfirmModalPhase.Done)
      onSuccess()
    } catch (e) {
      console.error('Shield failed', e)
      toast.error(getErrorMessage(e))
      setPhase(ConfirmModalPhase.Confirm)
    }
  }

  const requestClose = (): void => {
    if (shielding) return
    onClose()
  }

  let confirmLabel = advanced ? 'Sign & Send' : 'Confirm'
  if (shielding) confirmLabel = 'Shielding…'
  else if (!proverReady) confirmLabel = 'Preparing…'

  return (
    <Modal
      open={isOpen}
      onClose={requestClose}
      title={phase === ConfirmModalPhase.Done ? 'Funds shielded' : 'Confirm shield'}
      size={ModalSize.Lg}
      dismissible={!shielding}
    >
      {phase !== ConfirmModalPhase.Done ? (
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
            <div className={"mt-4 flex items-center gap-3 p-[.875rem] rounded-[.9375rem] dash-block"}>
              <Spinner size={18} className={"text-dash-brand dark:text-dash-mint"} />
              <Text size={14} weight={"medium"} color={"brand"}>{SHIELDED_PROVING_LABEL}…</Text>
            </div>
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

          <div className={"mt-5 flex flex-col gap-[.75rem] p-[.875rem] rounded-[.9375rem] dash-block-3"}>
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
