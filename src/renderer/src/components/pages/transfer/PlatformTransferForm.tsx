import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Input, Text } from "@renderer/components/dash-ui-kit-enxtended";
import { ChevronIcon } from "dash-ui-kit/react";
import { TransferPageType } from "@renderer/constants";
import { PlatformAddressDto } from "@renderer/api/types";
import { useAuth } from "@renderer/contexts/AuthContext";
import { usePlatformAddresses, prefetchPlatformAddresses } from "@renderer/hooks/usePlatformAddresses";
import { isValidPlatformAddress } from "@renderer/utils/platformAddress";
import AmountInput from "./AmountInput";
import PlatformSendConfirmModal from "@renderer/components/modal/PlatformSendConfirmModal";

const MIN_OUTPUT_CREDITS = 500_000n
const TRANSFER_FEE_CREDITS = 6_500_000n

const formatCredits = (credits: bigint): string => credits.toLocaleString('en-US')

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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (sourceRef.current && !sourceRef.current.contains(e.target as Node)) {
        setSourceOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const amountEntered = amount.trim().length > 0
  const amountValid = /^\d+$/.test(amount.trim())
  const amountCredits = amountValid ? BigInt(amount.trim()) : 0n
  const amountAboveMin = amountCredits >= MIN_OUTPUT_CREDITS
  const amountWithinBalance = amountCredits + TRANSFER_FEE_CREDITS <= availableCredits

  const trimmedRecipient = recipient.trim()
  const addressValid = isValidPlatformAddress(trimmedRecipient, network ?? undefined)
  const recipientIsSource = addressValid && selectedSource != null && trimmedRecipient === selectedSource.platformAddress

  const amountError = !amountEntered
    ? null
    : !amountValid
      ? 'Enter a whole number of credits.'
      : !amountAboveMin
        ? `Minimum transfer is ${formatCredits(MIN_OUTPUT_CREDITS)} credits.`
        : !amountWithinBalance
          ? `Amount plus the ${formatCredits(TRANSFER_FEE_CREDITS)} credit network fee exceeds this address balance.`
          : null

  const recipientError = trimmedRecipient.length === 0
    ? null
    : !addressValid
      ? `Enter a valid Platform ${network ?? ''} address.`
      : recipientIsSource
        ? 'Recipient must be different from the source address.'
        : null

  const canProceed = selectedSource != null && addressValid && !recipientIsSource && amountAboveMin && amountWithinBalance

  const handleMax = (): void => {
    const spendable = availableCredits - TRANSFER_FEE_CREDITS
    setAmount(spendable > 0n ? spendable.toString() : '0')
  }

  return (
    <>
      <div className={"flex w-full justify-center flex-1 min-h-0"}>
        <div className={"flex flex-col w-115 py-3"}>
          <div className={"flex flex-col gap-[.625rem] mb-4"} ref={sourceRef}>
            <Text size={16} weight={"medium"} color={"brand"} opacity={50} className={"leading-[120%]"}>From</Text>
            <div className={"relative"}>
              <button
                type={"button"}
                onClick={() => fundedAddresses.length > 0 && setSourceOpen(v => !v)}
                className={"w-full dash-input-search rounded-[.9375rem] px-6.25 py-3 flex items-center justify-between gap-3 cursor-pointer hover:opacity-90 transition-opacity"}
              >
                {selectedSource ? (
                  <div className={"flex flex-col items-start min-w-0"}>
                    <Text size={14} weight={"medium"} color={"brand"} className={"font-mono break-all text-left"}>{selectedSource.platformAddress}</Text>
                    <Text size={12} weight={"medium"} color={"brand"} opacity={50}>{formatCredits(BigInt(selectedSource.balanceCredits))} credits</Text>
                  </div>
                ) : (
                  <Text size={14} weight={"medium"} color={"brand"} opacity={50}>No funded Platform addresses</Text>
                )}
                <ChevronIcon size={12} className={`text-dash-brand dark:text-dash-mint transition-transform duration-200 ${sourceOpen ? 'rotate-180' : ''}`} />
              </button>

              {sourceOpen && (
                <div className={"absolute left-0 right-0 top-[calc(100%+.5rem)] z-20 p-[.375rem] rounded-[.9375rem] bg-white dark:bg-white/12 dark:backdrop-blur-[2rem] shadow-[0_0_35px_0_rgba(0,0,0,0.15)] max-h-72 overflow-y-auto scrollbar-hide"}>
                  {fundedAddresses.map(a => (
                    <button
                      key={a.platformAddress}
                      type={"button"}
                      onClick={() => { setSourceAddress(a.platformAddress); setSourceOpen(false) }}
                      className={`
                        w-full flex flex-col items-start gap-[.125rem] p-[.625rem] rounded-[.75rem] cursor-pointer
                        hover:dash-block-accent-10 transition-colors duration-150
                        ${a.platformAddress === selectedSource?.platformAddress ? 'dash-block-accent-5' : ''}
                      `}
                    >
                      <Text size={14} weight={"medium"} color={"brand"} className={"font-mono break-all text-left"}>{a.platformAddress}</Text>
                      <Text size={12} weight={"medium"} color={"brand"} opacity={50}>{formatCredits(BigInt(a.balanceCredits))} credits</Text>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <AmountInput
            value={amount}
            onChange={setAmount}
            onMax={handleMax}
            balanceLabel={`${pageData.header.balance}: ${formatCredits(availableCredits)} credits`}
            overBalance={amountCredits > 0n && !amountWithinBalance}
          />
          {amountError && (
            <span className={"mt-2 text-[.75rem] text-dash-red"}>{amountError}</span>
          )}

          <div className={"flex flex-col gap-[.625rem] mt-4"}>
            <Text size={16} weight={"medium"} color={"brand"} opacity={50} className={"leading-[120%]"}>
              {pageData.recipient.label}
            </Text>
            <div className={"dash-input-search rounded-[.9375rem] px-6.25 py-4"}>
              <Input
                type={"text"}
                value={recipient}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRecipient(e.target.value)}
                className={"outline-none text-[.875rem] dash-text-default placeholder:opacity-40 !ring-0 p-0 w-full"}
                placeholder={network === 'mainnet' ? 'dash1…' : 'tdash1…'}
                colorScheme={"transparent"}
              />
            </div>
            {recipientError && (
              <span className={"text-[.75rem] text-dash-red"}>{recipientError}</span>
            )}
          </div>
        </div>
      </div>

      <div className={"px-12"}>
        <div className={"flex flex-col gap-2"}>
          <div className={"flex flex-col gap-2 p-3 rounded-[.9375rem] dash-card-base shadow-[0_0_35px_0_rgba(0,0,0,0.1)]"}>
            <div className={"flex justify-between items-center"}>
              <Text size={12} weight={"medium"} color={"default"} opacity={50}>Amount</Text>
              <Text size={14} weight={"extrabold"} color={"default"}>{formatCredits(amountCredits)} credits</Text>
            </div>
            <div className={"flex justify-between items-center"}>
              <Text size={12} weight={"medium"} color={"default"} opacity={50}>Network fee</Text>
              <Text size={12} weight={"medium"} color={"default"}>{formatCredits(TRANSFER_FEE_CREDITS)} credits</Text>
            </div>
            <div className={"flex justify-between items-center"}>
              <Text size={12} weight={"medium"} color={"default"} opacity={50}>Total deducted</Text>
              <Text size={14} weight={"extrabold"} color={"default"}>{formatCredits(amountCredits + TRANSFER_FEE_CREDITS)} credits</Text>
            </div>
          </div>
          <Button
            className={"w-full rounded-[.9375rem]"}
            size={"md"}
            disabled={!canProceed}
            onClick={() => setConfirmOpen(true)}
          >
            {pageData.amountSummary.button}
          </Button>
        </div>
      </div>

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
          if (walletId) {
            prefetchPlatformAddresses(walletId)
          }
        }}
      />
    </>
  )
}
