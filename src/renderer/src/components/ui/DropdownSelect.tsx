import React, { useState, useRef, useCallback, useMemo } from 'react'
import { Text, Tooltip } from '@renderer/components/dash-ui-kit-extended'
import {
  WalletIcon,
  PlusIcon
} from '@renderer/components/dash-ui-kit-extended/icons'
import DropdownChevron from '@renderer/components/ui/DropdownChevron'
import { POPOVER, POPOVER_OPTION } from '@renderer/constants/surfaces'
import { useClickOutside } from '@renderer/hooks/useClickOutside'
import { useRipple } from '@renderer/hooks/useRipple'
import { WalletDropdownOption } from '@renderer/utils/wallets'

export interface DropdownSelectProps {
  options: WalletDropdownOption[]
  value: string
  onChange: (value: string) => void
  onAdd?: () => void
  addLabel?: string
  className?: string
}

export default function DropdownSelect({
  options,
  value,
  onChange,
  onAdd,
  addLabel = "Add wallet",
  className = "",
}: DropdownSelectProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const selectedOption = options.find((o) => o.value === value)

  const toggle = useCallback(() => setIsOpen((prev) => !prev), [])
  const close = useCallback(() => setIsOpen(false), [])

  const sortedOptions = useMemo(
    () => [...options].sort((a, b) => (b.value === value ? 1 : 0) - (a.value === value ? 1 : 0)),
    [options, value]
  )

  const handleSelect = useCallback(
    (val: string) => {
      close()
      setTimeout(() => onChange(val), 150)
    },
    [onChange, close]
  )

  useClickOutside(containerRef, close)
  const hoverNotification = useRipple()

  const selectedIsTestnet = selectedOption?.network === 'testnet'

  const trigger = (
    <button
      onMouseEnter={hoverNotification.onMouseEnter}
      onMouseMove={hoverNotification.onMouseMove}
      onMouseLeave={hoverNotification.onMouseLeave}
      type={"button"}
      onClick={toggle}
      className={`
        relative
        overflow-hidden
        flex items-center gap-3 px-4 h-12
        rounded-[.9375rem]
        dash-block-3
        dash-black-border
        cursor-pointer
        focus:outline-none
        ${selectedIsTestnet ? '!bg-dash-yellow/30' : ''}
      `}
    >
      <div className={"flex items-center gap-2"}>
        <WalletIcon size={16} color={"currentColor"} className={"dash-text-default"}/>
        <div className={"flex flex-col items-start gap-[.125rem]"}>
          <Text size={14} weight={"medium"} color={"brand"}>
            {selectedOption?.label}
          </Text>
          {selectedOption?.isSelected && (
            <Text size={10} weight={"medium"} color={"brand"} opacity={50}>
              Default
            </Text>
          )}
        </div>
      </div>
      <DropdownChevron open={isOpen} />
    </button>
  )

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {selectedIsTestnet
        ? <Tooltip label={"Testnet wallet"}>{trigger}</Tooltip>
        : trigger}

      <div className={`absolute left-0 top-[calc(100%+.375rem)] z-50 min-w-full w-max ${POPOVER} transition-opacity duration-150 ease-out ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className={"max-h-60 overflow-y-auto"}>
          {sortedOptions.map((option) => {
            const isTestnet = option.network === 'testnet'
            const row = (
              <div
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className={`
                  flex items-center gap-2 ${POPOVER_OPTION}
                  ${isTestnet
                    ? 'bg-dash-yellow/25 hover:bg-dash-yellow/40!'
                    : option.value === value ? 'dash-block-accent-5' : ''}
                `}
              >
                <WalletIcon size={16} color={"currentColor"} className={"dash-text-default"}/>
                <div className={"flex flex-col gap-[.125rem]"}>
                  <Text size={14} weight={"medium"} color={"brand"}>
                    {option.label}
                  </Text>
                  {option.isSelected && (
                    <Text size={10} weight={"medium"} color={"brand"} opacity={50}>
                      Default
                    </Text>
                  )}
                </div>
              </div>
            )

            return isTestnet
              ? <Tooltip key={option.value} label={"Testnet wallet"}>{row}</Tooltip>
              : row
          })}
        </div>

        {onAdd && (
          <div
            onClick={() => {
              onAdd()
              close()
            }}
            className={`flex items-center justify-center gap-3 ${POPOVER_OPTION}`}
          >
            <PlusIcon size={10} color={"currentColor"} className={"dash-text-default"} />
            <Text size={14} weight={"medium"} color={"brand"}>
              {addLabel}
            </Text>
          </div>
        )}
      </div>
    </div>
  )
}
