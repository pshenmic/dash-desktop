import { CheckIcon } from '@renderer/components/dash-ui-kit-enxtended'

type CheckboxProps = {
  checked: boolean
  onChange: (checked: boolean) => void
  label: React.ReactNode
  className?: string
}

export default function Checkbox({ checked, onChange, label, className = '' }: CheckboxProps): React.JSX.Element {
  return (
    <label className={`flex items-center gap-2.5 cursor-pointer select-none ${className}`}>
      <input
        type={"checkbox"}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={"peer sr-only"}
      />
      <span
        className={`
          shrink-0 size-[1.125rem] rounded-[.375rem] flex items-center justify-center
          border transition-colors duration-150
          ${checked
            ? 'border-transparent bg-dash-brand dark:bg-dash-mint'
            : 'border-dash-primary-dark-blue/25 dark:border-white/25 dash-block'}
          peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-dash-brand/40
        `}
      >
        {checked && (
          <CheckIcon size={12} color={"currentColor"} className={"text-white dark:text-dash-primary-dark-blue [&_circle]:hidden"} />
        )}
      </span>
      {label}
    </label>
  )
}
