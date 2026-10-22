import { useRef, useState } from "react";
import { Text } from "@renderer/components/dash-ui-kit-enxtended";
import { DashLogo, Identifier } from "dash-ui-kit/react";
import { WalletAddressDto } from "@renderer/api/types";
import DropdownChevron from "@renderer/components/ui/DropdownChevron";
import { ADDRESS_SELECT_IDENTIFIER_CLASS, ADDRESS_SELECT_MENU, ADDRESS_SELECT_OPTION, ADDRESS_SELECT_TRIGGER } from "@renderer/constants/addressSelect";
import { useClickOutside } from "@renderer/hooks/useClickOutside";
import { useFiat } from "@renderer/hooks/useFiat";
import { formatApproxFiat } from "@renderer/utils/approxFiat";
import { davToDashCompact } from "@renderer/utils/balance";

interface CoreAddressSelectProps {
  addresses: WalletAddressDto[]
  selected: WalletAddressDto | undefined
  onSelect: (address: string) => void
}

export default function CoreAddressSelect({addresses, selected, onSelect}: CoreAddressSelectProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { format: formatFiat, rateReady } = useFiat()

  useClickOutside(ref, () => setOpen(false))

  return (
    <div className={"relative w-fit self-start"} ref={ref}>
      <button
        type={"button"}
        onClick={() => addresses.length > 0 && setOpen(v => !v)}
        className={ADDRESS_SELECT_TRIGGER}
      >
        {selected ? (
          <div className={"flex items-center gap-2.5"}>
            <DashLogo size={18} className={"shrink-0"} />
            <div className={"flex flex-col items-start"}>
              <Identifier highlight={"both"} linesAdjustment={false} className={ADDRESS_SELECT_IDENTIFIER_CLASS}>{selected.address}</Identifier>
              <Text size={12} weight={"medium"} color={"brand"} opacity={50}>{davToDashCompact(selected.balance)} Dash</Text>
              {rateReady && <Text size={10} weight={"medium"} color={"blue-mint"}>{formatApproxFiat(formatFiat(selected.balance))}</Text>}
            </div>
          </div>
        ) : (
          <Text size={14} weight={"medium"} color={"brand"} opacity={50}>No receiving addresses</Text>
        )}
        <DropdownChevron open={open} />
      </button>

      {open && (
        <div className={ADDRESS_SELECT_MENU}>
          {addresses.map(a => (
            <button
              key={a.address}
              type={"button"}
              onClick={() => { onSelect(a.address); setOpen(false) }}
              className={`${ADDRESS_SELECT_OPTION} ${a.address === selected?.address ? 'dash-block-accent-5' : ''}`}
            >
              <DashLogo size={18} className={"shrink-0"} />
              <div className={"flex flex-col"}>
                <Identifier highlight={"both"} linesAdjustment={false} className={ADDRESS_SELECT_IDENTIFIER_CLASS}>{a.address}</Identifier>
                <Text size={12} weight={"medium"} color={"brand"} opacity={50}>{davToDashCompact(a.balance)} Dash</Text>
                {rateReady && <Text size={10} weight={"medium"} color={"blue-mint"}>{formatApproxFiat(formatFiat(a.balance))}</Text>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
