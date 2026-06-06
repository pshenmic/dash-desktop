import React, { useState, useRef, useCallback, useMemo } from 'react'
import { cva } from 'class-variance-authority'
import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import {
  WalletIcon,
  ChevronIcon,
  PlusIcon,
  DeleteIcon
} from '@renderer/components/dash-ui-kit-enxtended/icons'
import { useClickOutside } from '@renderer/hooks/useClickOutside'
import { useRipple } from '@renderer/hooks/useRipple'
import { WalletDropdownOption } from '@renderer/utils/wallets'

export interface DropdownSelectProps {
  options: WalletDropdownOption[]
  value: string
  onChange: (value: string) => void
  onItemAction?: (value: string) => void
  onAdd?: () => void
  addLabel?: string
  className?: string
}

const dropdownStyles = cva(
  `absolute top-0 left-0 z-50
  min-w-[3rem]
  rounded-[.9375rem]
  overflow-hidden
  dash-card-base
  shadow-[0_0_32px_0_rgba(0,0,0,0.12)]
  dark:backdrop-blur-xl
  transition-opacity duration-150 ease-out
  `,
  {
    variants: {
      isOpen: {
        true: 'opacity-100',
        false: 'opacity-0 pointer-events-none',
      },
    },
  }
)

export default function DropdownSelect({
  options,
  value,
  onChange,
  onItemAction,
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

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
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
        <ChevronIcon size={12} color={"currentColor"} className={"dash-text-default"} />
      </button>

      <div className={dropdownStyles({ isOpen })}>
        <div className={"max-h-72 overflow-y-auto"}>
          {sortedOptions.map((option, index) => (
            <div
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={`
                flex items-center justify-between gap-3
                pl-4 pr-2 h-12
                cursor-pointer transition-colors
                hover:bg-dash-primary-dark-blue/5 dark:hover:bg-white/5
                ${index < options.length - 1 || onAdd ? 'border-b border-dash-primary-dark-blue/8 dark:border-white/12' : ''}
              `}
            >
              <div className={"flex items-center gap-2"}>
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
              {onItemAction && (
                <button
                  type={"button"}
                  onClick={(e) => {
                    e.stopPropagation()
                    onItemAction(option.value)
                  }}
                  className={"flex items-center justify-center w-6 h-6 cursor-pointer rounded-md hover:bg-dash-primary-dark-blue/5 dark:hover:bg-white/5"}
                >
                  <DeleteIcon size={12} color={"currentColor"} className={"dash-text-default"} />
                </button>
              )}
            </div>
          ))}
        </div>

        {onAdd && (
          <div
            onClick={() => {
              onAdd()
              close()
            }}
            className={"flex items-center justify-center gap-3 h-12 cursor-pointer transition-colors hover:bg-dash-primary-dark-blue/5 dark:hover:bg-white/5"}
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
