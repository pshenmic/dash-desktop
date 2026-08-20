import { useRef, useState } from "react";
import { Text } from "@renderer/components/dash-ui-kit-enxtended";
import { ChevronIcon, DashLogo } from "dash-ui-kit/react";
import { WalletAddressDto } from "@renderer/api/types";
import { useClickOutside } from "@renderer/hooks/useClickOutside";
import { useFiat } from "@renderer/hooks/useFiat";
import { davToDashCompact } from "@renderer/utils/balance";

const fieldBox = "dash-block rounded-[.875rem] px-4 py-3.5"

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
        className={`w-max ${fieldBox} flex items-center justify-between gap-3 cursor-pointer hover:opacity-90 transition-opacity`}
      >
        {selected ? (
          <div className={"flex items-center gap-2.5"}>
            <DashLogo size={18} className={"shrink-0"} />
            <div className={"flex flex-col items-start"}>
              <Text size={14} weight={"medium"} color={"brand"} className={"font-mono whitespace-nowrap text-left"}>{selected.address}</Text>
              <Text size={12} weight={"medium"} color={"brand"} opacity={50}>{davToDashCompact(selected.balance)} Dash</Text>
              {rateReady && <Text size={10} weight={"medium"} color={"blue-mint"}>~ {formatFiat(selected.balance)}</Text>}
            </div>
          </div>
        ) : (
          <Text size={14} weight={"medium"} color={"brand"} opacity={50}>No receiving addresses</Text>
        )}
        <ChevronIcon size={12} className={`shrink-0 text-dash-brand dark:text-dash-mint transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className={"absolute left-0 top-[calc(100%+.375rem)] z-20 w-max min-w-full p-[.375rem] rounded-[.875rem] bg-white dark:bg-white/12 dark:backdrop-blur-[2rem] shadow-[0_0_35px_0_rgba(0,0,0,0.15)] max-h-72 overflow-y-auto scrollbar-hide"}>
          {addresses.map(a => (
            <button
              key={a.address}
              type={"button"}
              onClick={() => { onSelect(a.address); setOpen(false) }}
              className={`
                w-full flex items-center gap-2.5 p-[.625rem] rounded-[.625rem] cursor-pointer text-left
                hover:dash-block-accent-10 transition-colors duration-150
                ${a.address === selected?.address ? 'dash-block-accent-5' : ''}
              `}
            >
              <DashLogo size={18} className={"shrink-0"} />
              <div className={"flex flex-col"}>
                <Text size={14} weight={"medium"} color={"brand"} className={"font-mono whitespace-nowrap text-left"}>{a.address}</Text>
                <Text size={12} weight={"medium"} color={"brand"} opacity={50}>{davToDashCompact(a.balance)} Dash</Text>
                {rateReady && <Text size={10} weight={"medium"} color={"blue-mint"}>~ {formatFiat(a.balance)}</Text>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
