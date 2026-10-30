import { useRef, useState } from "react";
import { HighlightedIdentifier, Text, ShieldSmallIcon } from "@renderer/components/dash-ui-kit-extended";
import { useClickOutside } from "@renderer/hooks/useClickOutside";
import CreditsAmount from "@renderer/components/ui/CreditsAmount";
import DropdownChevron from "@renderer/components/ui/DropdownChevron";
import { ADDRESS_SELECT_MENU, ADDRESS_SELECT_OPTION, ADDRESS_SELECT_SHRINKING, ADDRESS_SELECT_TRIGGER, ADDRESS_SELECT_WRAPPING_IDENTIFIER_CLASS } from "@renderer/constants/addressSelect";

interface ShieldedAddressSelectProps {
  addresses: string[]
  balances?: Map<string, bigint>
  selected: string | undefined
  onSelect: (address: string) => void
}

export default function ShieldedAddressSelect({addresses, balances, selected, onSelect}: ShieldedAddressSelectProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useClickOutside(ref, () => setOpen(false))

  return (
    <div className={`relative self-start ${ADDRESS_SELECT_SHRINKING}`} ref={ref}>
      <button
        type={"button"}
        onClick={() => addresses.length > 0 && setOpen(v => !v)}
        className={`${ADDRESS_SELECT_TRIGGER} ${ADDRESS_SELECT_SHRINKING}`}
      >
        {selected ? (
          <div className={"flex min-w-0 items-center gap-2.5"}>
            <ShieldSmallIcon size={16} className={"shrink-0 text-dash-brand dark:text-dash-mint"} />
            <div className={"flex min-w-0 flex-col items-start"}>
              <HighlightedIdentifier className={ADDRESS_SELECT_WRAPPING_IDENTIFIER_CLASS}>{selected}</HighlightedIdentifier>
              {balances && (
                <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
                  <CreditsAmount credits={balances.get(selected) ?? 0n} />
                </Text>
              )}
            </div>
          </div>
        ) : (
          <Text size={14} weight={"medium"} color={"brand"} opacity={50}>No shielded addresses</Text>
        )}
        <DropdownChevron open={open} />
      </button>

      {open && (
        <div className={`${ADDRESS_SELECT_MENU} max-w-full`}>
          {addresses.map(address => (
            <button
              key={address}
              type={"button"}
              onClick={() => { onSelect(address); setOpen(false) }}
              className={`${ADDRESS_SELECT_OPTION} ${address === selected ? 'dash-block-accent-5' : ''}`}
            >
              <ShieldSmallIcon size={16} className={"shrink-0 text-dash-brand dark:text-dash-mint"} />
              <div className={"flex min-w-0 flex-col"}>
                <HighlightedIdentifier className={ADDRESS_SELECT_WRAPPING_IDENTIFIER_CLASS}>{address}</HighlightedIdentifier>
                {balances && (
                  <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
                    <CreditsAmount credits={balances.get(address) ?? 0n} />
                  </Text>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
