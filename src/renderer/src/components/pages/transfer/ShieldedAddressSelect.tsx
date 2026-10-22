import { useRef, useState } from "react";
import { Text, ShieldSmallIcon } from "@renderer/components/dash-ui-kit-enxtended";
import { Identifier } from "dash-ui-kit/react";
import { useClickOutside } from "@renderer/hooks/useClickOutside";
import CreditsAmount from "@renderer/components/ui/CreditsAmount";
import DropdownChevron from "@renderer/components/ui/DropdownChevron";
import { ADDRESS_SELECT_IDENTIFIER_CLASS, ADDRESS_SELECT_MENU, ADDRESS_SELECT_OPTION, ADDRESS_SELECT_TRIGGER } from "@renderer/constants/addressSelect";
import { truncateShieldedAddress } from "@renderer/utils/shieldedAddress";

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
    <div className={"relative w-fit self-start"} ref={ref}>
      <button
        type={"button"}
        title={selected}
        onClick={() => addresses.length > 0 && setOpen(v => !v)}
        className={ADDRESS_SELECT_TRIGGER}
      >
        {selected ? (
          <div className={"flex items-center gap-2.5"}>
            <ShieldSmallIcon size={16} className={"shrink-0 text-dash-brand dark:text-dash-mint"} />
            <div className={"flex flex-col items-start"}>
              <Identifier highlight={"both"} linesAdjustment={false} className={ADDRESS_SELECT_IDENTIFIER_CLASS}>{truncateShieldedAddress(selected)}</Identifier>
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
        <div className={ADDRESS_SELECT_MENU}>
          {addresses.map(address => (
            <button
              key={address}
              type={"button"}
              title={address}
              onClick={() => { onSelect(address); setOpen(false) }}
              className={`${ADDRESS_SELECT_OPTION} ${address === selected ? 'dash-block-accent-5' : ''}`}
            >
              <ShieldSmallIcon size={16} className={"shrink-0 text-dash-brand dark:text-dash-mint"} />
              <div className={"flex flex-col"}>
                <Identifier highlight={"both"} linesAdjustment={false} className={ADDRESS_SELECT_IDENTIFIER_CLASS}>{truncateShieldedAddress(address)}</Identifier>
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
