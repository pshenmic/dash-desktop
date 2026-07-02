import { useMemo, useState } from "react";
import { DashLogo } from "dash-ui-kit/react";
import { Text } from "@renderer/components/dash-ui-kit-enxtended";
import SyncGateNotice from "@renderer/components/ui/SyncGateNotice";
import { TransferPageType } from "@renderer/constants";
import { useAuth } from "@renderer/contexts/AuthContext";
import { useConnectionModeContext } from "@renderer/contexts/ConnectionModeContext";
import { useFiat } from "@renderer/hooks/useFiat";
import { useWalletBalance, refreshBalance } from "@renderer/hooks/useWalletBalance";
import { refreshTransactions } from "@renderer/hooks/useWalletTransactions";
import { davToDash, dashToDuffs } from "@renderer/utils/balance";
import { isValidDashAddress } from "@renderer/utils/address";
import SendConfirmModal from "@renderer/components/modal/SendConfirmModal";
import AmountField from "./AmountField";
import TransferWizard from "./TransferWizard";
import RecipientInput from "./RecipientInput";

export default function CoreTransferForm({pageData}: {pageData: TransferPageType}): React.JSX.Element {
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [wizardKey, setWizardKey] = useState(0)

  const { status } = useAuth()
  const { fallbackActive: syncIncomplete } = useConnectionModeContext()
  const walletId = status?.selectedWalletId ?? null
  const network = status?.network ?? null
  const { format: formatFiat, rateReady } = useFiat()

  const { balance } = useWalletBalance(walletId ?? undefined)
  const balanceDuffs = balance.dash.amount

  const amountDuffs = useMemo(() => dashToDuffs(amount), [amount])

  const handleAmount = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const val = e.target.value.replace(/[^0-9.]/g, '')
    const parts = val.split('.')
    if (parts.length > 2) return
    if (parts[1] && parts[1].length > 8) return
    setAmount(val)
  }

  const handleMax = (): void => {
    setAmount(davToDash(balanceDuffs))
  }

  const addressValid = isValidDashAddress(recipient, network ?? undefined)
  const recipientValid = recipient.trim().length === 0 || addressValid
  const amountPositive = amountDuffs > 0n
  const amountWithinBalance = amountDuffs <= balanceDuffs

  const amountReady = amountPositive && amountWithinBalance
  const canProceed = addressValid && amountReady

  const amountFiat = rateReady && amountPositive ? formatFiat(amountDuffs) : undefined

  const amountStep = (
    <div>
      <AmountField value={amount} onChange={handleAmount} onMax={handleMax} unit={<DashLogo size={20} />} />
      <div className={"mt-2 px-1 flex items-center justify-between gap-3"}>
        <Text size={12} weight={"medium"} color={amountPositive && !amountWithinBalance ? "red" : "brand"} opacity={amountPositive && !amountWithinBalance ? 100 : 50}>
          {amountPositive && !amountWithinBalance
            ? 'Amount exceeds balance'
            : `${pageData.header.balance}: ${davToDash(balanceDuffs)} Dash`}
        </Text>
        {amountFiat && <Text size={12} weight={"medium"} color={"blue-mint"}>≈ {amountFiat}</Text>}
      </div>
    </div>
  )

  const destinationStep = (
    <div>
      <RecipientInput
        value={recipient}
        onChange={setRecipient}
        data={pageData.recipient}
      />
      {!recipientValid && (
        <span className={"mt-2 block text-[.75rem] text-dash-red"}>
          Enter a valid Dash {network ?? ''} address.
        </span>
      )}
    </div>
  )

  const confirmStep = (
    <div className={"flex flex-col gap-3"}>
      <div className={"dash-block rounded-[.875rem] p-4 flex flex-col gap-1"}>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50}>To</Text>
        <Text size={14} weight={"medium"} color={"brand"} className={"font-mono break-all"}>{recipient.trim()}</Text>
      </div>
      <div className={"dash-block rounded-[.875rem] p-4 flex flex-col gap-2.5"}>
        <div className={"flex justify-between items-baseline gap-3"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>You send</Text>
          <Text size={16} weight={"extrabold"} color={"brand"}>{davToDash(amountDuffs)} Dash</Text>
        </div>
        {amountFiat && (
          <div className={"flex justify-between items-baseline gap-3"}>
            <Text size={12} weight={"medium"} color={"brand"} opacity={50}>≈ Fiat</Text>
            <Text size={12} weight={"medium"} color={"blue-mint"}>{amountFiat}</Text>
          </div>
        )}
      </div>
      {syncIncomplete && <SyncGateNotice />}
    </div>
  )

  return (
    <>
      <TransferWizard
        key={wizardKey}
        steps={[
          { label: 'Amount', content: amountStep, canAdvance: amountReady },
          { label: 'Destination', content: destinationStep, canAdvance: addressValid },
          { label: 'Confirm', content: confirmStep },
        ]}
        onSubmit={() => setConfirmOpen(true)}
        submitDisabled={!canProceed || syncIncomplete}
      />
      <SendConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        walletId={walletId}
        network={network}
        toAddress={recipient.trim()}
        amountDuffs={amountDuffs}
        amountFiat={amountFiat}
        onSuccess={() => {
          setRecipient('')
          setAmount('')
          setWizardKey(k => k + 1)
          if (walletId) {
            refreshBalance(walletId)
            refreshTransactions(walletId)
          }
        }}
      />
    </>
  )
}
