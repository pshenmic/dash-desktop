import { useRef, useState } from 'react'
import { ChevronIcon, Text } from '@renderer/components/dash-ui-kit-enxtended'
import { useClickOutside } from '@renderer/hooks/useClickOutside'
import type { DropdownFieldProps } from '@renderer/types/DropdownField'

export default function DropdownField({
  options,
  value,
  onChange,
  ariaLabel,
  triggerClassName,
  textSize = 14,
  renderIcon
}: DropdownFieldProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.value === value)

  useClickOutside(ref, () => setOpen(false))

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`w-full flex items-center justify-between gap-3 cursor-pointer hover:opacity-90 transition-opacity ${triggerClassName}`}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {renderIcon?.(value)}
          <Text size={textSize} weight="medium" color="brand" className="truncate">{selected?.label ?? value}</Text>
        </div>
        <ChevronIcon size={12} color="currentColor" className={`dash-text-primary shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+.375rem)] z-30 p-[.375rem] rounded-[.875rem] bg-white dark:bg-white/12 dark:backdrop-blur-[2rem] shadow-[0_0_35px_0_rgba(0,0,0,0.15)]">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
              className={`w-full flex items-center gap-2.5 p-[.625rem] rounded-[.625rem] cursor-pointer text-left hover:dash-block-accent-10 transition-colors duration-150 ${option.value === value ? 'dash-block-accent-5' : ''}`}
            >
              {renderIcon?.(option.value)}
              <Text size={textSize} weight="medium" color="brand">{option.label}</Text>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
