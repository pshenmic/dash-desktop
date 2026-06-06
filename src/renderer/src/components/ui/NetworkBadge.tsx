import { useCallback, useRef, useState } from "react";
import { Network } from "@renderer/api/types";
import { Text, WebIcon } from "../dash-ui-kit-enxtended";
import { ChevronIcon } from "../dash-ui-kit-enxtended/icons";
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
        {interactive && (
          <ChevronIcon
            size={10}
            color={"currentColor"}
            className={`text-white transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        )}
      </button>

      {interactive && isOpen && (
        <div
          className={`
            absolute right-0 mt-2 min-w-full
            rounded-[.9375rem] overflow-hidden
            bg-white/10 border border-white/15
            backdrop-blur-[.5rem]
            shadow-[0_8px_32px_0_rgba(0,0,0,0.24)]
          `}
        >
          {OPTIONS.map((option, index) => (
            <button
              key={option}
              type={"button"}
              onClick={() => handleSelect(option)}
              className={`
                flex items-center justify-between gap-3
                w-full px-4 h-12
                cursor-pointer transition-colors
                hover:bg-white/10
                ${index < OPTIONS.length - 1 ? 'border-b border-white/10' : ''}
              `}
            >
              <Text size={14} weight={"medium"} className={"text-white leading-[120%]"}>
                {NETWORK_LABELS[option]}
              </Text>
              {option === network && (
                <span className={"block size-2 rounded-full bg-dash-mint shadow-[0_0_8px_var(--color-dash-mint)]"} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
