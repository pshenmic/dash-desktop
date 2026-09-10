import { useRef, useState } from 'react'
import { ChevronIcon, Input, Text } from '@renderer/components/dash-ui-kit-enxtended'
import { useClickOutside } from '@renderer/hooks/useClickOutside'
import type { DropdownFieldProps } from '@renderer/types/DropdownField'

export default function DropdownField({
  options,
  value,
  onChange,
  ariaLabel,
  triggerClassName,
  textSize = 14,
  renderIcon,
  editable = false,
  placeholder,
  inputInvalid = false,
  inputSuffix,
}: DropdownFieldProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.value === value)

  useClickOutside(ref, () => setOpen(false))

  return (
    <div className="relative" ref={ref} onKeyDown={event => { if (editable && event.key === 'Escape') setOpen(false) }}>
      {editable ? <div className={`w-full flex items-center gap-3 ${triggerClassName}`}>
        <Input
          type="text"
          aria-label={ariaLabel}
          aria-invalid={inputInvalid}
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder={placeholder}
          colorScheme="transparent"
          variant="filled"
          className="outline-none text-[.875rem] dash-text-default placeholder:opacity-40 !ring-0 rounded-none! p-0 min-w-0 w-full"
        />
        {inputSuffix != null && <span className="shrink-0 whitespace-nowrap">{inputSuffix}</span>}
        <button
          type="button"
          aria-label={`Choose ${ariaLabel.toLowerCase()}`}
          aria-expanded={open}
          onClick={() => setOpen(current => !current)}
          className="shrink-0 flex items-center justify-center cursor-pointer hover:opacity-70 transition-opacity"
        >
          <ChevronIcon size={12} color="currentColor" className={`dash-text-default transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
      </div> : <button
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
        <ChevronIcon size={12} color="currentColor" className={`dash-text-default shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>}

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+.375rem)] z-30 max-h-60 overflow-y-auto scrollbar-custom p-[.375rem] rounded-[.875rem] bg-white dark:bg-white/12 dark:backdrop-blur-[2rem] shadow-[0_0_35px_0_rgba(0,0,0,0.15)]">
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
              <div className="min-w-0 flex flex-col gap-0.5">
                <Text size={textSize} weight="medium" color="brand" className="break-all">{option.label}</Text>
                {option.description && <Text size={12} weight="medium" color="brand" opacity={50}>{option.description}</Text>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
