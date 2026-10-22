import { useEffect, useRef, useState } from "react";
import { Text, CreditsIcon } from "@renderer/components/dash-ui-kit-enxtended";
import { Identifier } from "dash-ui-kit/react";
import type { PlatformAddressSelectProps } from "@renderer/types/PlatformAddressSelect";
import { useClickOutside } from "@renderer/hooks/useClickOutside";
import CreditsAmount from "@renderer/components/ui/CreditsAmount";
import DropdownChevron from "@renderer/components/ui/DropdownChevron";
import Spinner from "@renderer/components/ui/Spinner";
import { RefreshIcon } from "@renderer/components/dash-ui-kit-enxtended/icons";
import { ADDRESS_SELECT_IDENTIFIER_CLASS, ADDRESS_SELECT_MENU, ADDRESS_SELECT_OPTION, ADDRESS_SELECT_TRIGGER } from "@renderer/constants/addressSelect";

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
          <Identifier highlight={"both"} linesAdjustment={false} className={ADDRESS_SELECT_IDENTIFIER_CLASS}>{selected.platformAddress}</Identifier>
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
    action = <DropdownChevron open={open} />
  }

  return (
    <div className={"relative w-fit self-start"} ref={ref}>
      <button
        type={"button"}
        aria-label={error ? 'Reload Platform addresses' : 'Select Platform address'}
        aria-busy={loading}
        disabled={loading}
        onClick={handleClick}
        className={ADDRESS_SELECT_TRIGGER}
      >
        {content}
        {action}
      </button>

      {open && !loading && !error && (
        <div className={ADDRESS_SELECT_MENU}>
          {automaticLabel != null && (
            <button
              type={"button"}
              onClick={() => { onSelect(''); setOpen(false) }}
              className={`${ADDRESS_SELECT_OPTION} ${selected == null ? 'dash-block-accent-5' : ''}`}
            >
              <Text reset size={14} weight={"medium"} color={"brand"} className={"whitespace-nowrap text-left"}>{automaticLabel}</Text>
            </button>
          )}
          {addresses.map(a => (
            <button
              key={a.platformAddress}
              type={"button"}
              onClick={() => { onSelect(a.platformAddress); setOpen(false) }}
              className={`${ADDRESS_SELECT_OPTION} ${a.platformAddress === selected?.platformAddress ? 'dash-block-accent-5' : ''}`}
            >
              <CreditsIcon size={18} className={"shrink-0"} />
              <div className={"flex flex-col"}>
                <Identifier highlight={"both"} linesAdjustment={false} className={ADDRESS_SELECT_IDENTIFIER_CLASS}>{a.platformAddress}</Identifier>
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
