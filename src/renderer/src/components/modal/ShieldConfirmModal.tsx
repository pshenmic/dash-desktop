import { useEffect, useRef, useState } from 'react'
import { Input, Text, SuccessIcon } from '../dash-ui-kit-enxtended'
import { useAuth } from '@renderer/contexts/AuthContext'
import { API } from '@renderer/api'
import { ShieldResult } from '@renderer/api/types'
import type { ShieldConfirmModalProps } from '@renderer/types/ShieldConfirmModal'
import { platformTransactionUrl } from '@renderer/utils/explorer'
import { ConfirmModalPhase } from '@renderer/enums/ConfirmModalPhase'
import { ModalSize } from '@renderer/enums/ModalSize'
import Spinner from '@renderer/components/ui/Spinner'
import CopyableError from '@renderer/components/ui/CopyableError'
import Modal from '@renderer/components/ui/Modal'
import ModalActions from '@renderer/components/ui/ModalActions'
import HashField from '@renderer/components/ui/HashField'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import TxSummary from '@renderer/components/ui/TxSummary'
import { TxEndpointKind } from '@renderer/enums/TxEndpointKind'
import { TX_SUMMARY_LABELS } from '@renderer/constants/txSummary'
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
      setError(e instanceof Error ? e.message : 'Shield failed')
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
              <div className={"flex flex-col"}>
                <Text size={14} weight={"medium"} color={"brand"}>Generating zero-knowledge proof…</Text>
                <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Proving then broadcasting — this can take a few seconds.</Text>
              </div>
            </div>
          ) : (
            <>
              <Text size={14} weight={"medium"} color={"brand"} opacity={40} className={"mt-4 block"}>
                Enter your wallet password to prove and broadcast.
              </Text>
              <div className={"mt-2"}>
                <Input
                  id={"shield-password"}
                  type={"password"}
                  placeholder={"Wallet password"}
                  value={password}
                  variant={"outlined"}
                  onChange={(e) => { setError(null); setPassword(e.target.value) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm() }}
                  className={"h-14.25 rounded-[1.25rem] bg-transparent!"}
                  colorScheme={error ? 'error' : 'primary'}
                  autoFocus
                />
              </div>
            </>
          )}

          <div
            className={`
              overflow-hidden transition-all duration-200
              ${error ? 'max-h-40 opacity-100 mt-2' : 'max-h-0 opacity-0'}
            `}
          >
            <CopyableError message={error ?? ''} />
          </div>

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
            <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"mt-1"}>
              Moved into the shielded pool. If it went to your own address, re-sync notes to see it.
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
