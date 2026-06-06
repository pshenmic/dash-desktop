import React, { useCallback, useMemo, useRef, useState } from 'react'
import { cva } from 'class-variance-authority'
import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { ChevronIcon, WebIcon, PlusIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'
import { useClickOutside } from '@renderer/hooks/useClickOutside'
import { useRipple } from '@renderer/hooks/useRipple'
import { Network } from '@renderer/api/types'

export interface NetworkSelectProps {
  value: Network
  walletCounts: Record<Network, number>
  onSelectNetwork: (network: Network) => void
  onCreateOnNetwork: (network: Network) => void
  className?: string
}

const NETWORK_LABELS: Record<Network, string> = {
  mainnet: 'Mainnet',
  testnet: 'Testnet',
}

const OPTIONS: Network[] = ['mainnet', 'testnet']

const dropdownStyles = cva(
  `absolute top-0 left-0 z-50
   w-full
   rounded-[.9375rem]
   overflow-hidden
   dash-card-base
   shadow-[0_0_32px_0_rgba(0,0,0,0.12)]
   dark:backdrop-blur-xl
   transition-opacity duration-150 ease-out`,
  {
    variants: {
      isOpen: {
        true: 'opacity-100',
        false: 'opacity-0 pointer-events-none',
      },
    },
  }
)

export default function NetworkSelect({
  value,
  walletCounts,
  onSelectNetwork,
  onCreateOnNetwork,
  className = '',
}: NetworkSelectProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const sortedOptions = useMemo(
    () => [...OPTIONS].sort((a, b) => (b === value ? 1 : 0) - (a === value ? 1 : 0)),
    [value]
  )

  const toggle = useCallback(() => setIsOpen((prev) => !prev), [])
  const close = useCallback(() => setIsOpen(false), [])

  const handleSelect = useCallback(
    (network: Network) => {
      close()
      if (walletCounts[network] === 0) {
        setTimeout(() => onCreateOnNetwork(network), 50)
        return
      }
      if (network === value) return
      setTimeout(() => onSelectNetwork(network), 50)
    },
    [value, walletCounts, onSelectNetwork, onCreateOnNetwork, close]
  )

  useClickOutside(containerRef, close)
  const hoverRipple = useRipple()

  return (
    <div ref={containerRef} className={`relative inline-block w-[10.5rem] ${className}`}>
      <button
        onMouseEnter={hoverRipple.onMouseEnter}
        onMouseMove={hoverRipple.onMouseMove}
        onMouseLeave={hoverRipple.onMouseLeave}
        type={"button"}
        onClick={toggle}
        className={`
          relative
          overflow-hidden
          flex items-center gap-3 px-4 h-12 w-full
          rounded-[.9375rem]
          dash-block-3
          dash-black-border
          cursor-pointer
          focus:outline-none
        `}
      >
        <WebIcon size={14} color={"currentColor"} className={"dash-text-default shrink-0"} />
        <div className={"flex flex-col items-start gap-[.125rem] min-w-0 flex-1 text-left"}>
          <Text size={14} weight={"medium"} color={"brand"} className={"truncate max-w-full"}>
            {NETWORK_LABELS[value]}
          </Text>
          <Text size={10} weight={"medium"} color={"brand"} opacity={50} className={"truncate max-w-full"}>
            {walletCounts[value]} {walletCounts[value] === 1 ? 'wallet' : 'wallets'}
          </Text>
        </div>
        <ChevronIcon size={12} color={"currentColor"} className={"dash-text-default shrink-0"} />
      </button>

      <div className={dropdownStyles({ isOpen })}>
        {sortedOptions.map((option, index) => {
          const isSelected = option === value
          const count = walletCounts[option]
          const hasWallet = count > 0
          return (
            <div
              key={option}
              onClick={() => handleSelect(option)}
              className={`
                flex items-center justify-between gap-3
                px-4 h-12
                cursor-pointer transition-colors
                hover:bg-dash-primary-dark-blue/5 dark:hover:bg-white/5
                ${index < sortedOptions.length - 1
                  ? 'border-b border-dash-primary-dark-blue/8 dark:border-b-white/12'
                  : ''}
              `}
            >
              <div className={"flex items-center gap-3 min-w-0 flex-1"}>
                <WebIcon size={14} color={"currentColor"} className={"dash-text-default shrink-0"} />
                <div className={"flex flex-col gap-[.125rem] min-w-0 flex-1"}>
                  <Text size={14} weight={"medium"} color={"brand"} className={"truncate max-w-full"}>
                    {NETWORK_LABELS[option]}
                  </Text>
                  <Text size={10} weight={"medium"} color={"brand"} opacity={50} className={"truncate max-w-full"}>
                    {hasWallet
                      ? `${count} ${count === 1 ? 'wallet' : 'wallets'}`
                      : 'Create wallet'}
                  </Text>
                </div>
              </div>
              {isSelected
                ? <ChevronIcon size={12} color={"currentColor"} className={"dash-text-default rotate-180"} />
                : !hasWallet && <PlusIcon size={10} color={"currentColor"} className={"dash-text-default"} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
