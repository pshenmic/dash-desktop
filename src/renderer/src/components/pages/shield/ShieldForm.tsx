import { useMemo, useRef, useState } from "react";
import { Text, CreditsIcon, ShieldSmallIcon } from "@renderer/components/dash-ui-kit-enxtended";
import { BigNumber, ChevronIcon } from "dash-ui-kit/react";
import { PlatformAddressDto } from "@renderer/api/types";
import { useAuth } from "@renderer/contexts/AuthContext";
import { usePlatformAddresses, prefetchPlatformAddresses } from "@renderer/hooks/usePlatformAddresses";
import { useClickOutside } from "@renderer/hooks/useClickOutside";
import AmountField from "@renderer/components/pages/transfer/AmountField";
import TransferWizard from "@renderer/components/pages/transfer/TransferWizard";
import ShieldConfirmModal from "@renderer/components/modal/ShieldConfirmModal";

const MIN_OUTPUT_CREDITS = 500_000n
const SHIELD_FEE_CREDITS = 6_500_000n

const fieldBox = "dash-block rounded-[.875rem] px-4 py-3.5"

export default function ShieldForm({ warmupReady }: { warmupReady: boolean }): React.JSX.Element {
  const { status } = useAuth()
  const walletId = status?.selectedWalletId ?? null

  const { platformAddresses } = usePlatformAddresses(walletId ?? undefined)

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
  const amountWithinBalance = amountCredits + SHIELD_FEE_CREDITS <= availableCredits

  const amountError = amount.length === 0
    ? null
    : !amountAboveMin
      ? `Minimum shield is ${MIN_OUTPUT_CREDITS.toLocaleString('en-US')} credits.`
      : !amountWithinBalance
        ? `Amount plus the ${SHIELD_FEE_CREDITS.toLocaleString('en-US')} credit fee exceeds this balance.`
        : null

  const amountReady = selectedSource != null && amountAboveMin && amountWithinBalance

  const handleAmount = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setAmount(e.target.value.replace(/[^\d]/g, ''))
  }

  const handleMax = (): void => {
    const spendable = availableCredits - SHIELD_FEE_CREDITS
    setAmount(spendable > 0n ? spendable.toString() : '0')
  }

  const amountStep = (
    <>
      <div>
        <AmountField value={amount} onChange={handleAmount} onMax={handleMax} unit={<CreditsIcon size={20} />} />
        <div className={"mt-2 px-1 flex items-center justify-between gap-3"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
            Balance: <BigNumber>{availableCredits.toString()}</BigNumber> credits
          </Text>
          {amountError && <Text size={12} weight={"medium"} color={"red"} className={"text-right"}>{amountError}</Text>}
        </div>
      </div>

      <div className={"flex flex-col gap-2"} ref={sourceRef}>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50}>From (transparent)</Text>
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

  const confirmStep = (
    <div className={"flex flex-col gap-3"}>
      <div className={"dash-block rounded-[.875rem] p-4 flex flex-col gap-3"}>
        <div className={"flex flex-col gap-1"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>From (transparent)</Text>
          <Text size={14} weight={"medium"} color={"brand"} className={"font-mono break-all"}>{selectedSource?.platformAddress ?? ''}</Text>
        </div>
        <div className={"flex flex-col gap-1"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>To</Text>
          <div className={"flex items-center gap-1.5"}>
            <ShieldSmallIcon size={14} className={"text-dash-brand dark:text-dash-mint"} />
            <Text size={14} weight={"medium"} color={"blue-mint"}>your shielded balance</Text>
          </div>
        </div>
      </div>
      <div className={"dash-block rounded-[.875rem] p-4 flex flex-col gap-2.5"}>
        <div className={"flex justify-between items-baseline gap-3"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Amount</Text>
          <Text size={14} weight={"medium"} color={"brand"}><BigNumber>{amountCredits.toString()}</BigNumber> credits</Text>
        </div>
        <div className={"flex justify-between items-baseline gap-3"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Network fee (est.)</Text>
          <Text size={14} weight={"medium"} color={"brand"}><BigNumber>{SHIELD_FEE_CREDITS.toString()}</BigNumber> credits</Text>
        </div>
        <div className={"h-px bg-dash-primary-dark-blue/8 dark:bg-white/10"} />
        <div className={"flex justify-between items-baseline gap-3"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>Total</Text>
          <Text size={16} weight={"extrabold"} color={"brand"}><BigNumber>{(amountCredits + SHIELD_FEE_CREDITS).toString()}</BigNumber> credits</Text>
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
          { label: 'Confirm', content: confirmStep },
        ]}
        onSubmit={() => setConfirmOpen(true)}
        submitLabel={"Shield"}
        submitDisabled={!amountReady}
      />
      <ShieldConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        walletId={walletId}
        fromAddress={selectedSource?.platformAddress ?? ''}
        amountCredits={amountCredits.toString()}
        warmupReady={warmupReady}
        onSuccess={() => {
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
