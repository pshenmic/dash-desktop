import { CheckIcon } from '@renderer/components/dash-ui-kit-enxtended'
import { CHECKBOX_APPEARANCE_STYLES } from '@renderer/constants/checkbox'
import type { CheckboxProps } from '@renderer/types/Checkbox'

export default function Checkbox({ checked, onChange, label, className = '', disabled = false, appearance = 'default' }: CheckboxProps): React.JSX.Element {
  const styles = CHECKBOX_APPEARANCE_STYLES[appearance]
  return (
    <label className={`flex items-center gap-2.5 cursor-pointer select-none ${className}`}>
      <input
        type={"checkbox"}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className={"peer sr-only"}
      />
      <span
        className={`
          shrink-0 size-[1.125rem] rounded-[.375rem] flex items-center justify-center
          border transition-colors duration-150
          ${checked ? styles.checked : styles.unchecked}
          peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-dash-brand/40
        `}
      >
        {checked && (
          <CheckIcon size={12} color={"currentColor"} className={`${styles.check} [&_circle]:hidden`} />
        )}
      </span>
      {label}
    </label>
  )
}
