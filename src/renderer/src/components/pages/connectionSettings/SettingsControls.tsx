import {InfoTooltip, Text} from '@renderer/components/dash-ui-kit-enxtended'
import type {
  ConnectionSectionTitleProps,
  ConnectionSettingsRowProps,
  ConnectionSwitchProps,
} from '@renderer/types/connection'

export function SectionTitle({label, tooltip, className = ''}: ConnectionSectionTitleProps): React.JSX.Element {
  return (
    <div className={`mb-3 flex items-center gap-2 ${className}`}>
      <Text as="h2" size={14} weight="medium" color="brand" opacity={50}>
        {label}
      </Text>
      <InfoTooltip content={tooltip} />
    </div>
  )
}

export function SwitchControl({
  checked,
  disabled = false,
  label,
  positions,
  onChange,
}: ConnectionSwitchProps): React.JSX.Element {
  return (
    <div
      role={positions ? 'radiogroup' : undefined}
      aria-label={positions ? label : undefined}
      className={`relative grid w-[3.25rem] shrink-0 ${positions ? 'h-10 grid-cols-2' : 'h-6'} ${disabled ? 'opacity-60' : ''}`}
    >
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-6 rounded-full bg-dash-primary-dark-blue/15 dark:bg-white/15">
        <span
          className={`block size-6 rounded-full bg-dash-brand shadow-sm transition-transform dark:bg-dash-mint ${checked ? 'translate-x-7' : 'translate-x-0'}`}
        />
      </div>
      {positions ? positions.map((position, index) => {
        const nextChecked = index === 1
        return (
          <button
            key={position.ariaLabel}
            type="button"
            role="radio"
            aria-label={position.ariaLabel}
            aria-checked={checked === nextChecked}
            disabled={disabled}
            onClick={() => {
              if (!disabled && checked !== nextChecked) onChange(nextChecked)
            }}
            className={`relative z-10 flex cursor-pointer items-start justify-center text-[9px] font-medium leading-none disabled:cursor-not-allowed ${checked === nextChecked
              ? 'text-dash-brand dark:text-dash-mint'
              : 'text-dash-primary-dark-blue/45 dark:text-white/45'}`}
          >
            {position.label}
          </button>
        )
      }) : (
        <button
          type="button"
          role="switch"
          aria-label={label}
          aria-checked={checked ?? false}
          disabled={disabled}
          onClick={() => {
            if (!disabled) onChange(!checked)
          }}
          className="relative z-10 h-6 w-full cursor-pointer rounded-full disabled:cursor-not-allowed"
        />
      )}
    </div>
  )
}

export function SettingsRow({label, children}: ConnectionSettingsRowProps): React.JSX.Element {
  return (
    <div className="flex min-h-[3.75rem] items-center justify-between gap-5 rounded-[1.25rem] dash-block px-4 py-3 sm:px-5">
      <Text size={14} weight="medium" color="brand" className="min-w-0">
        {label}
      </Text>
      {children}
    </div>
  )
}
