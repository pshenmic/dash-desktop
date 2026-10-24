import { useCallback, useRef, useState } from "react";
import { Network } from "@renderer/api/types";
import { Text, WebIcon } from "../dash-ui-kit-enxtended";
import DropdownChevron from "./DropdownChevron";
import { POPOVER, POPOVER_OPTION } from "@renderer/constants/surfaces";
import { useClickOutside } from "@renderer/hooks/useClickOutside";

const NETWORK_LABELS: Record<Network, string> = {
  mainnet: 'mainnet',
  testnet: 'testnet',
}

const OPTIONS: Network[] = ['mainnet', 'testnet']

interface NetworkBadgeProps {
  network: Network
  onChange?: (network: Network) => void
}

export default function NetworkBadge({ network, onChange }: NetworkBadgeProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const interactive = typeof onChange === 'function'

  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => {
    if (!interactive) return
    setIsOpen((prev) => !prev)
  }, [interactive])

  const handleSelect = useCallback(
    (value: Network) => {
      close()
      if (value !== network) onChange?.(value)
    },
    [network, onChange, close]
  )

  useClickOutside(containerRef, close)

  return (
    <div ref={containerRef} className={"absolute top-12 right-12 z-50"}>
      <button
        type={"button"}
        onClick={toggle}
        disabled={!interactive}
        className={`
          flex items-center justify-center gap-2 px-4 h-12
          rounded-[.9375rem]
          bg-white/5 border border-white/15
          backdrop-blur-[.5rem]
          ${interactive ? 'cursor-pointer hover:bg-white/10 transition-colors' : 'cursor-default'}
        `}
      >
        <WebIcon size={14} color={"white"}/>
        <Text size={14} weight={"medium"} className={"text-white leading-[120%]"}>
          {NETWORK_LABELS[network]}
        </Text>
        {interactive && <DropdownChevron open={isOpen} className={"text-white"} />}
      </button>

      {interactive && isOpen && (
        <div className={`absolute right-0 top-[calc(100%+.375rem)] min-w-full ${POPOVER}`}>
          {OPTIONS.map((option) => (
            <button
              key={option}
              type={"button"}
              onClick={() => handleSelect(option)}
              className={`
                flex items-center justify-between gap-3 w-full text-left ${POPOVER_OPTION}
                ${option === network ? 'dash-block-accent-5' : ''}
              `}
            >
              <Text size={14} weight={"medium"} color={"brand"}>
                {NETWORK_LABELS[option]}
              </Text>
              {option === network && (
                <span className={"block size-2 rounded-full dash-block-accent"} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
