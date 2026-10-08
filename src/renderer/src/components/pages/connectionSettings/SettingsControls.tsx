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

export function SwitchControl({checked, disabled = false, label, onChange}: ConnectionSwitchProps): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`
        flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors
        disabled:cursor-not-allowed disabled:opacity-60
        ${checked
          ? 'justify-end bg-dash-brand/30 dark:bg-dash-mint/25'
          : 'justify-start bg-dash-primary-dark-blue/15 dark:bg-white/15'}
      `}
    >
      <span
        className={`
          size-6 rounded-full shadow-sm transition-colors
          ${checked ? 'bg-dash-brand dark:bg-dash-mint' : 'bg-white'}
        `}
      />
    </button>
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
