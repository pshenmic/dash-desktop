import { Text, CreditsIcon } from "@renderer/components/dash-ui-kit-enxtended";
import Checkbox from "@renderer/components/ui/Checkbox";
import CreditsAmount from "@renderer/components/ui/CreditsAmount";
import { PlatformAddressDto } from "@renderer/api/types";

interface PlatformInputPickerProps {
  addresses: PlatformAddressDto[]
  picked: string[]
  onToggle: (platformAddress: string, checked: boolean) => void
  onClear: () => void
  feeAddress: string | null
  onFeeAddressChange: (platformAddress: string) => void
  feeCredits: bigint | null
  maxInputs: number
}

export default function PlatformInputPicker({
  addresses, picked, onToggle, onClear, feeAddress, onFeeAddressChange, feeCredits, maxInputs,
}: PlatformInputPickerProps): React.JSX.Element {
  const chosen = new Set(picked)
  const full = picked.length >= maxInputs
  const total = addresses
    .filter(entry => chosen.has(entry.platformAddress))
    .reduce((sum, entry) => sum + BigInt(entry.balanceCredits), 0n)

  return (
    <div className={"flex flex-col gap-2"}>
      <div className={"flex items-center justify-between gap-3"}>
        <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
          Picked {picked.length}/{maxInputs}
        </Text>
        <div className={"flex items-center gap-3"}>
          <Text size={12} weight={"medium"} color={"brand"}>
            <CreditsAmount credits={total} />
          </Text>
          {picked.length > 0 && (
            <button
              type={"button"}
              onClick={onClear}
              className={"px-2.5 py-1 rounded-[.5rem] dash-block-accent-5 hover:opacity-80 transition-opacity cursor-pointer"}
            >
              <Text size={12} weight={"medium"} color={"blue-mint"}>Clear</Text>
            </button>
          )}
        </div>
      </div>

      <div className={"dash-block rounded-[.875rem] p-[.375rem] max-h-72 overflow-y-auto scrollbar-hide flex flex-col"}>
        {addresses.length === 0 && (
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"p-[.625rem]"}>
            No funded Platform addresses
          </Text>
        )}
        {addresses.map(entry => {
          const isPicked = chosen.has(entry.platformAddress)
          const paysFee = isPicked && entry.platformAddress === feeAddress
          const keptBack = paysFee && feeCredits !== null ? feeCredits : 0n
          const short = paysFee && feeCredits !== null && BigInt(entry.balanceCredits) <= feeCredits

          return (
            <div
              key={entry.platformAddress}
              className={`flex items-center gap-2.5 p-[.625rem] rounded-[.625rem] ${isPicked ? 'dash-block-accent-5' : ''} ${!isPicked && full ? 'opacity-40' : ''}`}
            >
              <Checkbox
                checked={isPicked}
                // The cap is consensus, not a preference: an unpicked row goes
                // inert rather than silently swapping out one of the picks.
                onChange={next => (isPicked || !full) && onToggle(entry.platformAddress, next)}
                label={
                  <div className={"flex items-center gap-2.5"}>
                    <CreditsIcon size={18} className={"shrink-0"} />
                    <div className={"flex flex-col"}>
                      <Text reset size={12} weight={"medium"} color={"brand"} className={"font-mono whitespace-nowrap text-left"}>
                        {entry.platformAddress}
                      </Text>
                      <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
                        <CreditsAmount credits={BigInt(entry.balanceCredits) - keptBack} />
                        {paysFee && ' after the fee'}
                      </Text>
                    </div>
                  </div>
                }
              />

              {isPicked && (
                <label className={"ml-auto shrink-0 flex items-center gap-1.5 cursor-pointer select-none"}>
                  <input
                    type={"radio"}
                    checked={paysFee}
                    onChange={() => onFeeAddressChange(entry.platformAddress)}
                    className={"accent-dash-brand dark:accent-dash-mint"}
                  />
                  <Text size={12} weight={"medium"} color={short ? "red" : "brand"} opacity={paysFee ? 100 : 50}>
                    Pays fee
                  </Text>
                </label>
              )}
            </div>
          )
        })}
      </div>

      <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
        The amount is drawn from the addresses you pick, largest share first, and
        whatever is not drawn stays where it is. The one paying keeps the fee back
        out of its own balance, and a transition takes at most {maxInputs} of them.
      </Text>
    </div>
  )
}
