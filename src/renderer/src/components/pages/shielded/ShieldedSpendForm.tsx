import { useState } from "react";
import { Text, CreditsIcon, ShieldSmallIcon } from "@renderer/components/dash-ui-kit-enxtended";
import { BigNumber } from "dash-ui-kit/react";
import { useAuth } from "@renderer/contexts/AuthContext";
import { useShieldedSyncState } from "@renderer/hooks/useShielded";
import { isValidPlatformAddress } from "@renderer/utils/platformAddress";
import { isValidDashAddress } from "@renderer/utils/address";
import { isLikelyShieldedAddress } from "@renderer/utils/shieldedAddress";
import { API } from "@renderer/api";
import { ShieldedSpendState } from "@renderer/api/types";
import AmountField from "@renderer/components/pages/transfer/AmountField";
import TransferWizard from "@renderer/components/pages/transfer/TransferWizard";
import ShieldedSpendModal from "@renderer/components/modal/ShieldedSpendModal";

const MIN_OUTPUT_CREDITS = 500_000n
const SPEND_FEE_CREDITS = 6_500_000n
const fieldBox = "dash-block rounded-[.875rem] px-4 py-3.5"

type SpendKind = 'transfer' | 'unshield' | 'withdrawal'

interface Props {
  kind: SpendKind
  warmupReady: boolean
}

export default function ShieldedSpendForm({ kind, warmupReady }: Props): React.JSX.Element {
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? null
  const network = status?.network ?? null

  const sync = useShieldedSyncState(walletId)
  const available = sync.phase === 'done' && sync.balance !== null ? BigInt(sync.balance) : null

  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')
  const [acked, setAcked] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [wizardKey, setWizardKey] = useState(0)

  const amountCredits = amount.length > 0 ? BigInt(amount) : 0n
  const amountAboveMin = amountCredits >= MIN_OUTPUT_CREDITS
  const amountWithinBalance = available === null || amountCredits + SPEND_FEE_CREDITS <= available

  const trimmed = recipient.trim()
  const addressValid = kind === 'transfer'
    ? isLikelyShieldedAddress(trimmed)
    : kind === 'unshield'
      ? isValidPlatformAddress(trimmed, network ?? undefined)
      : isValidDashAddress(trimmed, network ?? undefined)

  const amountError = amount.length === 0
    ? null
    : !amountAboveMin
      ? `Minimum is ${MIN_OUTPUT_CREDITS.toLocaleString('en-US')} credits.`
      : !amountWithinBalance
        ? `Amount plus the ${SPEND_FEE_CREDITS.toLocaleString('en-US')} credit fee exceeds your shielded balance.`
        : null

  const recipientError = trimmed.length === 0
    ? null
    : !addressValid
      ? (kind === 'transfer'
        ? 'Enter a valid shielded address.'
        : kind === 'unshield'
          ? `Enter a valid Platform ${network ?? ''} address.`
          : `Enter a valid Dash ${network ?? ''} address.`)
      : null

  const amountReady = amountAboveMin && amountWithinBalance
  const destinationReady = addressValid && (kind !== 'withdrawal' || acked)
  const canProceed = amountReady && destinationReady

  const handleAmount = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setAmount(e.target.value.replace(/[^\d]/g, ''))
  }

  const handleMax = (): void => {
    if (available === null) return
    const spendable = available - SPEND_FEE_CREDITS
    setAmount(spendable > 0n ? spendable.toString() : '0')
  }

  const toLabel = kind === 'transfer' ? 'To (shielded)' : kind === 'unshield' ? 'To (Platform)' : 'To (Core L1)'
  const placeholder = kind === 'transfer'
    ? 'shielded address'
    : kind === 'unshield'
      ? (network === 'mainnet' ? 'dash1…' : 'tdash1…')
      : (network === 'mainnet' ? 'X… (Dash address)' : 'y… (Dash address)')

  const modalTitle = kind === 'transfer' ? 'Send privately' : kind === 'unshield' ? 'Unshield' : 'Withdraw to L1'

  const start = (password: string): Promise<ShieldedSpendState> => {
    if (!walletId) {
      return Promise.resolve<ShieldedSpendState>({ phase: 'error', fetched: 0, total: 0, stHash: null, error: 'No wallet selected' })
    }
    if (kind === 'transfer') return API.startShieldedTransfer(walletId, trimmed, amountCredits.toString(), password)
    if (kind === 'unshield') return API.startShieldedUnshield(walletId, trimmed, amountCredits.toString(), password)
    return API.startShieldedWithdrawal(walletId, trimmed, amountCredits.toString(), password)
  }

  const amountStep = (
    <div>
      <AmountField value={amount} onChange={handleAmount} onMax={handleMax} unit={<CreditsIcon size={20} />} />
      <div className={"mt-2 px-1 flex items-center justify-between gap-3"}>
        {available !== null ? (
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
            Available: <BigNumber>{available.toString()}</BigNumber> credits
          </Text>
        ) : (
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Sync notes on Overview to see your balance</Text>
        )}
        {amountError && <Text size={12} weight={"medium"} color={"red"} className={"text-right"}>{amountError}</Text>}
      </div>
    </div>
  )

  const destinationStep = (
    <div className={"flex flex-col gap-2"}>
      <Text size={12} weight={"medium"} color={"brand"} opacity={50}>{toLabel}</Text>
      <div className={`${fieldBox} ${recipientError ? 'outline outline-1 outline-dash-red' : ''}`}>
        <input
          type={"text"}
          value={recipient}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRecipient(e.target.value)}
          className={"w-full bg-transparent outline-none text-[.875rem] font-mono dash-text-default placeholder:opacity-30"}
          placeholder={placeholder}
        />
      </div>
      {recipientError && <Text size={12} weight={"medium"} color={"red"} className={"px-1"}>{recipientError}</Text>}

      {kind === 'unshield' && (
        <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"px-1 leading-[130%]"}>
          Unshield moves credits from the pool to a transparent Platform address — the amount and destination become public.
        </Text>
      )}

      {kind === 'withdrawal' && (
        <div className={"mt-1 flex flex-col gap-[.375rem] p-[.875rem] rounded-[.9375rem] dash-block-3"}>
          <Text size={14} weight={"extrabold"} color={"brand"}>Output becomes public</Text>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
            The receiving Core address and the amount will be publicly visible on-chain once withdrawn. This breaks the privacy of the withdrawn funds.
          </Text>
          <label className={"mt-1 flex items-center gap-2 cursor-pointer"}>
            <input type={"checkbox"} checked={acked} onChange={(e) => setAcked(e.target.checked)} className={"accent-dash-brand"} />
            <Text size={12} weight={"medium"} color={"brand"}>I understand the destination and amount will be public.</Text>
          </label>
        </div>
      )}
    </div>
  )

  const confirmStep = (
    <div className={"flex flex-col gap-3"}>
      <div className={"dash-block rounded-[.875rem] p-4 flex flex-col gap-3"}>
        <div className={"flex items-center gap-2"}>
          <ShieldSmallIcon size={14} className={"text-dash-brand dark:text-dash-mint"} />
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>From your shielded balance</Text>
        </div>
        <div className={"flex flex-col gap-1"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>{toLabel}</Text>
          <Text size={14} weight={"medium"} color={"brand"} className={"font-mono break-all"}>{trimmed}</Text>
        </div>
      </div>
      <div className={"dash-block rounded-[.875rem] p-4 flex flex-col gap-2.5"}>
        <div className={"flex justify-between items-baseline gap-3"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Amount</Text>
          <Text size={14} weight={"medium"} color={"brand"}><BigNumber>{amountCredits.toString()}</BigNumber> credits</Text>
        </div>
        <div className={"flex justify-between items-baseline gap-3"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Network fee (est.)</Text>
          <Text size={14} weight={"medium"} color={"brand"}><BigNumber>{SPEND_FEE_CREDITS.toString()}</BigNumber> credits</Text>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <TransferWizard
        key={wizardKey}
        steps={[
          { label: 'Amount', content: amountStep, canAdvance: amountReady },
          { label: 'Destination', content: destinationStep, canAdvance: destinationReady },
          { label: 'Confirm', content: confirmStep },
        ]}
        onSubmit={() => setConfirmOpen(true)}
        submitLabel={"Send"}
        submitDisabled={!canProceed}
      />
      <ShieldedSpendModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        walletId={walletId}
        title={modalTitle}
        toLabel={toLabel}
        toValue={trimmed}
        amountCredits={amountCredits.toString()}
        warmupReady={warmupReady}
        start={start}
        onSuccess={() => {
          setAmount('')
          setRecipient('')
          setAcked(false)
          setWizardKey(k => k + 1)
        }}
      />
    </>
  )
}
