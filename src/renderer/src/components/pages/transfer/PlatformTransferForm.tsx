import { useMemo, useRef, useState } from "react";
import { Text, CreditsIcon } from "@renderer/components/dash-ui-kit-enxtended";
import { BigNumber, ChevronIcon } from "dash-ui-kit/react";
import { TransferPageType } from "@renderer/constants";
import { PlatformAddressDto } from "@renderer/api/types";
import { useAuth } from "@renderer/contexts/AuthContext";
import { usePlatformAddresses, prefetchPlatformAddresses } from "@renderer/hooks/usePlatformAddresses";
import { useClickOutside } from "@renderer/hooks/useClickOutside";
import { isValidPlatformAddress } from "@renderer/utils/platformAddress";
import AmountField from "./AmountField";
import TransferWizard from "./TransferWizard";
import PlatformSendConfirmModal from "@renderer/components/modal/PlatformSendConfirmModal";

const MIN_OUTPUT_CREDITS = 500_000n
const TRANSFER_FEE_CREDITS = 6_500_000n

const fieldBox = "dash-block rounded-[.875rem] px-4 py-3.5"

export default function PlatformTransferForm({pageData}: {pageData: TransferPageType}): React.JSX.Element {
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? null
  const network = status?.network ?? null

  const { platformAddresses } = usePlatformAddresses(walletId ?? undefined)

  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [sourceAddress, setSourceAddress] = useState('')
  const [sourceOpen, setSourceOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [wizardKey, setWizardKey] = useState(0)
  const sourceRef = useRef<HTMLDivElement>(null)

  const fundedAddresses = useMemo(
    () => platformAddresses.filter(a => BigInt(a.balanceCredits) > 0n),
    [platformAddresses],
  )

  const defaultSource = useMemo(
    () => fundedAddresses.reduce<PlatformAddressDto | undefined>(
      (best, a) => (best == null || BigInt(a.balanceCredits) > BigInt(best.balanceCredits) ? a : best),
      undefined,
    ),
    [fundedAddresses],
  )

  const selectedSource = fundedAddresses.find(a => a.platformAddress === sourceAddress) ?? defaultSource
  const availableCredits = selectedSource ? BigInt(selectedSource.balanceCredits) : 0n

  useClickOutside(sourceRef, () => setSourceOpen(false))

  const amountCredits = amount.length > 0 ? BigInt(amount) : 0n
  const amountAboveMin = amountCredits >= MIN_OUTPUT_CREDITS
  const amountWithinBalance = amountCredits + TRANSFER_FEE_CREDITS <= availableCredits

  const trimmedRecipient = recipient.trim()
  const addressValid = isValidPlatformAddress(trimmedRecipient, network ?? undefined)
  const recipientIsSource = addressValid && selectedSource != null && trimmedRecipient === selectedSource.platformAddress

  const amountError = amount.length === 0
    ? null
    : !amountAboveMin
      ? `Minimum transfer is ${MIN_OUTPUT_CREDITS.toLocaleString('en-US')} credits.`
      : !amountWithinBalance
        ? `Amount plus the ${TRANSFER_FEE_CREDITS.toLocaleString('en-US')} credit fee exceeds this balance.`
        : null

  const recipientError = trimmedRecipient.length === 0
    ? null
    : !addressValid
      ? `Enter a valid Platform ${network ?? ''} address.`
      : recipientIsSource
        ? 'Recipient must be different from the source address.'
        : null

  const amountReady = selectedSource != null && amountAboveMin && amountWithinBalance
  const destinationReady = addressValid && !recipientIsSource
  const canProceed = amountReady && destinationReady

  const handleAmount = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setAmount(e.target.value.replace(/[^\d]/g, ''))
  }

  const handleMax = (): void => {
    const spendable = availableCredits - TRANSFER_FEE_CREDITS
    setAmount(spendable > 0n ? spendable.toString() : '0')
  }

  const amountStep = (
    <>
      <div>
        <AmountField value={amount} onChange={handleAmount} onMax={handleMax} unit={<CreditsIcon size={20} />} />
        <div className={"mt-2 px-1 flex items-center justify-between gap-3"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
            {pageData.header.balance}: <BigNumber>{availableCredits.toString()}</BigNumber> credits
          </Text>
          {amountError && <Text size={12} weight={"medium"} color={"red"} className={"text-right"}>{amountError}</Text>}
        </div>
      </div>

      <div className={"flex flex-col gap-2"} ref={sourceRef}>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50}>From</Text>
        <div className={"relative"}>
          <button
            type={"button"}
            onClick={() => fundedAddresses.length > 0 && setSourceOpen(v => !v)}
            className={`w-full ${fieldBox} flex items-center justify-between gap-3 cursor-pointer hover:opacity-90 transition-opacity`}
          >
            {selectedSource ? (
              <div className={"flex items-center gap-2.5 min-w-0"}>
                <CreditsIcon size={18} className={"shrink-0"} />
                <div className={"flex flex-col items-start min-w-0"}>
                  <Text size={14} weight={"medium"} color={"brand"} className={"font-mono break-all text-left"}>{selectedSource.platformAddress}</Text>
                  <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
                    <BigNumber>{selectedSource.balanceCredits}</BigNumber> credits
                  </Text>
                </div>
              </div>
            ) : (
              <Text size={14} weight={"medium"} color={"brand"} opacity={50}>No funded Platform addresses</Text>
            )}
            <ChevronIcon size={12} className={`shrink-0 text-dash-brand dark:text-dash-mint transition-transform duration-200 ${sourceOpen ? 'rotate-180' : ''}`} />
          </button>

          {sourceOpen && (
            <div className={"absolute left-0 right-0 top-[calc(100%+.375rem)] z-20 p-[.375rem] rounded-[.875rem] bg-white dark:bg-white/12 dark:backdrop-blur-[2rem] shadow-[0_0_35px_0_rgba(0,0,0,0.15)] max-h-72 overflow-y-auto scrollbar-hide"}>
              {fundedAddresses.map(a => (
                <button
                  key={a.platformAddress}
                  type={"button"}
                  onClick={() => { setSourceAddress(a.platformAddress); setSourceOpen(false) }}
                  className={`
                    w-full flex items-center gap-2.5 p-[.625rem] rounded-[.625rem] cursor-pointer text-left
                    hover:dash-block-accent-10 transition-colors duration-150
                    ${a.platformAddress === selectedSource?.platformAddress ? 'dash-block-accent-5' : ''}
                  `}
                >
                  <CreditsIcon size={18} className={"shrink-0"} />
                  <div className={"flex flex-col min-w-0"}>
                    <Text size={14} weight={"medium"} color={"brand"} className={"font-mono break-all text-left"}>{a.platformAddress}</Text>
                    <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
                      <BigNumber>{a.balanceCredits}</BigNumber> credits
                    </Text>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )

  const destinationStep = (
    <div className={"flex flex-col gap-2"}>
      <Text size={12} weight={"medium"} color={"brand"} opacity={50}>To</Text>
      <div className={`${fieldBox} ${recipientError ? 'outline outline-1 outline-dash-red' : ''}`}>
        <input
          type={"text"}
          value={recipient}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRecipient(e.target.value)}
          className={"w-full bg-transparent outline-none text-[.875rem] font-mono dash-text-default placeholder:opacity-30"}
          placeholder={network === 'mainnet' ? 'dash1…' : 'tdash1…'}
        />
      </div>
      {recipientError && (
        <Text size={12} weight={"medium"} color={"red"} className={"px-1"}>{recipientError}</Text>
      )}
    </div>
  )

  const confirmStep = (
    <div className={"flex flex-col gap-3"}>
      <div className={"dash-block rounded-[.875rem] p-4 flex flex-col gap-3"}>
        <div className={"flex flex-col gap-1"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>From</Text>
          <Text size={14} weight={"medium"} color={"brand"} className={"font-mono break-all"}>{selectedSource?.platformAddress ?? ''}</Text>
        </div>
        <div className={"flex flex-col gap-1"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>To</Text>
          <Text size={14} weight={"medium"} color={"brand"} className={"font-mono break-all"}>{trimmedRecipient}</Text>
        </div>
      </div>
      <div className={"dash-block rounded-[.875rem] p-4 flex flex-col gap-2.5"}>
        <div className={"flex justify-between items-baseline gap-3"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Amount</Text>
          <Text size={14} weight={"medium"} color={"brand"}><BigNumber>{amountCredits.toString()}</BigNumber> credits</Text>
        </div>
        <div className={"flex justify-between items-baseline gap-3"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Network fee</Text>
          <Text size={14} weight={"medium"} color={"brand"}><BigNumber>{TRANSFER_FEE_CREDITS.toString()}</BigNumber> credits</Text>
        </div>
        <div className={"h-px bg-dash-primary-dark-blue/8 dark:bg-white/10"} />
        <div className={"flex justify-between items-baseline gap-3"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Total</Text>
          <Text size={16} weight={"extrabold"} color={"brand"}><BigNumber>{(amountCredits + TRANSFER_FEE_CREDITS).toString()}</BigNumber> credits</Text>
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
        submitDisabled={!canProceed}
      />
      <PlatformSendConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        walletId={walletId}
        fromAddress={selectedSource?.platformAddress ?? ''}
        toAddress={trimmedRecipient}
        amountCredits={amountCredits.toString()}
        onSuccess={() => {
          setRecipient('')
          setAmount('')
          setWizardKey(k => k + 1)
          if (walletId) {
            prefetchPlatformAddresses(walletId)
          }
        }}
      />
    </>
  )
}
