import { useRef, useState } from "react";
import { Text, ShieldSmallIcon } from "@renderer/components/dash-ui-kit-enxtended";
import { ChevronIcon } from "dash-ui-kit/react";
import { useClickOutside } from "@renderer/hooks/useClickOutside";
import CreditsAmount from "@renderer/components/ui/CreditsAmount";

const fieldBox = "dash-block rounded-[.875rem] px-4 py-3.5"

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
    <div className={"relative"} ref={ref}>
      <button
        type={"button"}
        onClick={() => addresses.length > 0 && setOpen(v => !v)}
        className={`w-full ${fieldBox} flex items-center justify-between gap-3 cursor-pointer hover:opacity-90 transition-opacity`}
      >
        {selected ? (
          <div className={"flex items-center gap-2.5 min-w-0"}>
            <ShieldSmallIcon size={16} className={"shrink-0 text-dash-brand dark:text-dash-mint"} />
            <div className={"flex flex-col items-start min-w-0"}>
              <Text size={14} weight={"medium"} color={"brand"} className={"font-mono break-all text-left"}>{selected}</Text>
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
        <ChevronIcon size={12} className={`shrink-0 text-dash-brand dark:text-dash-mint transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className={"absolute left-0 right-0 top-[calc(100%+.375rem)] z-20 p-[.375rem] rounded-[.875rem] bg-white dark:bg-white/12 dark:backdrop-blur-[2rem] shadow-[0_0_35px_0_rgba(0,0,0,0.15)] max-h-72 overflow-y-auto scrollbar-hide"}>
          {addresses.map(address => (
            <button
              key={address}
              type={"button"}
              onClick={() => { onSelect(address); setOpen(false) }}
              className={`
                w-full flex items-center gap-2.5 p-[.625rem] rounded-[.625rem] cursor-pointer text-left
                hover:dash-block-accent-10 transition-colors duration-150
                ${address === selected ? 'dash-block-accent-5' : ''}
              `}
            >
              <ShieldSmallIcon size={16} className={"shrink-0 text-dash-brand dark:text-dash-mint"} />
              <div className={"flex flex-col min-w-0"}>
                <Text size={14} weight={"medium"} color={"brand"} className={"font-mono break-all text-left"}>{address}</Text>
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
