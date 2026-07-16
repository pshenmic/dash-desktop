import { useRef, useState } from "react";
import { Text, CreditsIcon } from "@renderer/components/dash-ui-kit-enxtended";
import { BigNumber, ChevronIcon } from "dash-ui-kit/react";
import { PlatformAddressDto } from "@renderer/api/types";
import { useClickOutside } from "@renderer/hooks/useClickOutside";

const fieldBox = "dash-block rounded-[.875rem] px-4 py-3.5"

interface PlatformAddressSelectProps {
  addresses: PlatformAddressDto[]
  selected: PlatformAddressDto | undefined
  onSelect: (platformAddress: string) => void
}

export default function PlatformAddressSelect({addresses, selected, onSelect}: PlatformAddressSelectProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useClickOutside(ref, () => setOpen(false))

  return (
    <div className={"relative"} ref={ref}>
      <button
        type={"button"}
        onClick={() => addresses.length > 0 && setOpen(v => !v)}
        className={`w-full ${fieldBox} flex items-center justify-between gap-3 cursor-pointer hover:opacity-90 transition-opacity`}
      >
        {selected ? (
          <div className={"flex items-center gap-2.5 min-w-0"}>
            <CreditsIcon size={18} className={"shrink-0"} />
            <div className={"flex flex-col items-start min-w-0"}>
              <Text size={14} weight={"medium"} color={"brand"} className={"font-mono break-all text-left"}>{selected.platformAddress}</Text>
              <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
                <BigNumber>{selected.balanceCredits}</BigNumber> credits
              </Text>
            </div>
          </div>
        ) : (
          <Text size={14} weight={"medium"} color={"brand"} opacity={50}>No funded Platform addresses</Text>
        )}
        <ChevronIcon size={12} className={`shrink-0 text-dash-brand dark:text-dash-mint transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className={"absolute left-0 right-0 top-[calc(100%+.375rem)] z-20 p-[.375rem] rounded-[.875rem] bg-white dark:bg-white/12 dark:backdrop-blur-[2rem] shadow-[0_0_35px_0_rgba(0,0,0,0.15)] max-h-72 overflow-y-auto scrollbar-hide"}>
          {addresses.map(a => (
            <button
              key={a.platformAddress}
              type={"button"}
              onClick={() => { onSelect(a.platformAddress); setOpen(false) }}
              className={`
                w-full flex items-center gap-2.5 p-[.625rem] rounded-[.625rem] cursor-pointer text-left
                hover:dash-block-accent-10 transition-colors duration-150
                ${a.platformAddress === selected?.platformAddress ? 'dash-block-accent-5' : ''}
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
  )
}
