import { useEffect, useRef, useState } from "react";
import { Text, CreditsIcon } from "@renderer/components/dash-ui-kit-enxtended";
import { ChevronIcon } from "dash-ui-kit/react";
import type { PlatformAddressSelectProps } from "@renderer/types/PlatformAddressSelect";
import { useClickOutside } from "@renderer/hooks/useClickOutside";
import CreditsAmount from "@renderer/components/ui/CreditsAmount";
import Spinner from "@renderer/components/ui/Spinner";
import { RefreshIcon } from "@renderer/components/dash-ui-kit-enxtended/icons";

const fieldBox = "dash-block rounded-[.875rem] px-4 py-3.5"

export default function PlatformAddressSelect({addresses, selected, onSelect, automaticLabel, loading = false, error = null, onRetry}: PlatformAddressSelectProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useClickOutside(ref, () => setOpen(false))

  useEffect(() => {
    if (loading || error) setOpen(false)
  }, [loading, error])

  const handleClick = (): void => {
    if (loading) return
    if (error) {
      onRetry?.()
      return
    }
    if (addresses.length > 0) setOpen(value => !value)
  }

  let content: React.JSX.Element
  if (selected) {
    content = (
      <div className={"flex items-center gap-2.5"}>
        <CreditsIcon size={18} className={"shrink-0"} />
        <div className={"flex flex-col items-start"}>
          <Text reset size={14} weight={"medium"} color={"brand"} className={"font-mono whitespace-nowrap text-left"}>{selected.platformAddress}</Text>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
            <CreditsAmount credits={selected.balanceCredits} />
          </Text>
        </div>
      </div>
    )
  } else if (loading || error) {
    content = <Text size={14} weight={"medium"} color={"brand"} opacity={50}>Platform address</Text>
  } else if (automaticLabel != null && addresses.length > 0) {
    content = <Text size={14} weight={"medium"} color={"brand"}>{automaticLabel}</Text>
  } else {
    content = <Text size={14} weight={"medium"} color={"brand"} opacity={50}>No funded Platform addresses</Text>
  }

  let action: React.JSX.Element
  if (loading) {
    action = <span role="status" aria-label="Loading Platform addresses"><Spinner size={14} className="dash-text-primary" /></span>
  } else if (error) {
    action = <RefreshIcon size={14} color="currentColor" className="dash-text-primary" />
  } else {
    action = <ChevronIcon size={12} className={`shrink-0 text-dash-brand dark:text-dash-mint transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
  }

  return (
    <div className={"relative w-fit self-start"} ref={ref}>
      <button
        type={"button"}
        aria-label={error ? 'Reload Platform addresses' : 'Select Platform address'}
        aria-busy={loading}
        disabled={loading}
        onClick={handleClick}
        className={`w-max ${fieldBox} flex items-center justify-between gap-3 cursor-pointer hover:opacity-90 transition-opacity`}
      >
        {content}
        {action}
      </button>

      {open && !loading && !error && (
        <div className={"absolute left-0 top-[calc(100%+.375rem)] z-20 w-max min-w-full p-[.375rem] rounded-[.875rem] bg-white dark:bg-white/12 dark:backdrop-blur-[2rem] shadow-[0_0_35px_0_rgba(0,0,0,0.15)] max-h-72 overflow-y-auto scrollbar-hide"}>
          {automaticLabel != null && (
            <button
              type={"button"}
              onClick={() => { onSelect(''); setOpen(false) }}
              className={`
                w-full flex items-center gap-2.5 p-[.625rem] rounded-[.625rem] cursor-pointer text-left
                hover:dash-block-accent-10 transition-colors duration-150
                ${selected == null ? 'dash-block-accent-5' : ''}
              `}
            >
              <Text reset size={14} weight={"medium"} color={"brand"} className={"whitespace-nowrap text-left"}>{automaticLabel}</Text>
            </button>
          )}
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
              <div className={"flex flex-col"}>
                <Text reset size={14} weight={"medium"} color={"brand"} className={"font-mono whitespace-nowrap text-left"}>{a.platformAddress}</Text>
                <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
                  <CreditsAmount credits={a.balanceCredits} />
                </Text>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
