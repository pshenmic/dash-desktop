import React, { useState, useRef, useCallback, useMemo } from 'react'
import { cva } from 'class-variance-authority'
import { Text } from '@renderer/components/dash-ui-kit-enxtended'
import { ChevronIcon } from '@renderer/components/dash-ui-kit-enxtended/icons'
import { useClickOutside } from '@renderer/hooks/useClickOutside'
import { useRipple } from '@renderer/hooks/useRipple'

export interface ConnectionSelectOption {
  value: string
  label: string
  active?: boolean
}

export interface ConnectionSelectProps {
  options: ConnectionSelectOption[]
  value: string
  onChange: (value: string) => void
  className?: string
}

export function StatusDot({ active }: { active: boolean }): React.JSX.Element {
  if (active) {
    return (
      <span
        className={`
          block size-3 shrink-0 rounded-full bg-dash-mint
          shadow-[0_0_12px_var(--color-dash-mint)]
        `}
      />
    )
  }

  return (
    <span
      className={`
        block size-3 shrink-0 rounded-full
        dash-block-12 border border-dash-primary-dark-blue/12
        dark:border-white/12
        shadow-[0_0_12px_rgba(0,0,0,0.24)] dark:shadow-[0_0_12px_rgba(255,255,255,0.24)]
      `}
    />
  )
}

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

export default function ConnectionSelect({
  options,
  value,
  onChange,
  className = '',
}: ConnectionSelectProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const selectedOption = options.find((o) => o.value === value)

  const sortedOptions = useMemo(
    () => [...options].sort((a, b) => (b.value === value ? 1 : 0) - (a.value === value ? 1 : 0)),
    [options, value]
  )

  const toggle = useCallback(() => setIsOpen((prev) => !prev), [])
  const close = useCallback(() => setIsOpen(false), [])

  const handleSelect = useCallback(
    (val: string) => {
      close()
      setTimeout(() => onChange(val), 50)
    },
    [onChange, close]
  )

  useClickOutside(containerRef, close)
  const hoverNotification = useRipple()

  return (
    <div ref={containerRef} className={`relative inline-block w-[10.5rem] ${className}`}>
      <button
        onMouseEnter={hoverNotification.onMouseEnter}
        onMouseMove={hoverNotification.onMouseMove}
        onMouseLeave={hoverNotification.onMouseLeave}
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
        <StatusDot active={true} />
        <div className={"flex items-center min-w-0 flex-1 text-left"}>
          <Text size={14} weight={"medium"} color={"brand"} className={"truncate max-w-full"}>
            {selectedOption?.label}
          </Text>
        </div>
        <ChevronIcon size={12} color={"currentColor"} className={"dash-text-default shrink-0"} />
      </button>

      <div className={dropdownStyles({ isOpen })}>
        {sortedOptions.map((option, index) => {
          const isSelected = option.value === value
          return (
            <div
              key={option.value}
              onClick={() => handleSelect(option.value)}
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
                <StatusDot active={isSelected} />
                <Text size={14} weight={"medium"} color={"brand"} className={"truncate max-w-full"}>
                  {option.label}
                </Text>
              </div>
              {isSelected && (
                <ChevronIcon
                  size={12}
                  color={"currentColor"}
                  className={"dash-text-default rotate-180"}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
