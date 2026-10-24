import React, { useState, useRef, useCallback, useMemo } from 'react'
import { Text, Tooltip } from '@renderer/components/dash-ui-kit-enxtended'
import { WalletIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'
import DropdownChevron from '@renderer/components/ui/DropdownChevron'
import { POPOVER, POPOVER_OPTION } from '@renderer/constants/surfaces'
import { useClickOutside } from '@renderer/hooks/useClickOutside'
import { WalletDropdownOption } from '@renderer/utils/wallets'

export interface WalletSelectProps {
  options: WalletDropdownOption[]
  value: string
  onChange: (value: string) => void
  className?: string
  disabled?: boolean
}

function DefaultBadge(): React.JSX.Element {
  return (
    <span className={"flex items-center justify-center px-3 py-1 rounded-xl dash-block-12"}>
      <Text size={10} weight={"medium"} color={"brand"}>
        Default
      </Text>
    </span>
  )
}

export default function WalletSelect({
  options,
  value,
  onChange,
  className = '',
  disabled = false
}: WalletSelectProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const selectedOption = options.find((o) => o.value === value)
  const selectedIsTestnet = selectedOption?.network === 'testnet'

  const sortedOptions = useMemo(
    () => [...options].sort((a, b) => (b.value === value ? 1 : 0) - (a.value === value ? 1 : 0)),
    [options, value]
  )

  const toggle = useCallback(() => {
    if (!disabled) setIsOpen((prev) => !prev)
  }, [disabled])

  const close = useCallback(() => setIsOpen(false), [])

  const handleSelect = useCallback(
    (val: string) => {
      close()
      setTimeout(() => onChange(val), 200)
    },
    [onChange, close]
  )

  useClickOutside(containerRef, close)

  const trigger = (
    <button
      type={"button"}
      disabled={disabled}
      onClick={toggle}
      className={`
        flex items-center w-full px-6.25 h-14.25
        rounded-[1.25rem]
        border border-dash-primary-dark-blue/32 dark:border-white/32
        cursor-pointer
        focus:outline-none
        ${disabled ? 'cursor-default!' : ''}
        ${selectedIsTestnet ? '!bg-dash-yellow/30' : ''}
      `}
    >
      <div className={"flex flex-1 items-center justify-between"}>
        <div className={"flex items-center gap-2"}>
          <WalletIcon size={16} color={"currentColor"} className={"dash-text-default"} />
          <div className={"flex items-center gap-2"}>
            <Text size={14} weight={"medium"} color={"brand"}>
              {selectedOption?.label}
            </Text>
            {selectedOption?.isSelected && <DefaultBadge />}
          </div>
        </div>
        {!disabled && <DropdownChevron open={isOpen} />}
      </div>
    </button>
  )

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {selectedIsTestnet
        ? <Tooltip label={"Testnet wallet"}>{trigger}</Tooltip>
        : trigger}

      <div className={`absolute bottom-[calc(100%+.375rem)] left-0 right-0 z-50 max-h-60 overflow-y-auto ${POPOVER} transition-opacity duration-200 ease-out ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {sortedOptions.map((option) => {
          const isSelected = option.value === value
          const isTestnet = option.network === 'testnet'
          const row = (
            <div
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={`
                flex items-center gap-2 ${POPOVER_OPTION}
                ${isTestnet
                  ? 'bg-dash-yellow/25 hover:bg-dash-yellow/40!'
                  : isSelected ? 'dash-block-accent-5' : ''}
              `}
            >
              <WalletIcon size={16} color={"currentColor"} className={"dash-text-default"} />
              <div className={"flex items-center gap-2"}>
                <Text size={14} weight={"medium"} color={"brand"}>
                  {option.label}
                </Text>
                {option.isSelected && <DefaultBadge />}
              </div>
            </div>
          )

          return isTestnet
            ? <Tooltip key={option.value} label={"Testnet wallet"}>{row}</Tooltip>
            : row
        })}
      </div>
    </div>
  )
}
