import { Text } from '@renderer/components/dash-ui-kit-extended'
import { REGISTER_USERNAME_COPY } from '@renderer/constants/dashPayUsernames'
import { DPNS_LABEL_MAX, DPNS_NAME_SUFFIX } from '@renderer/constants/dpns'
import type { UsernameFieldProps } from '@renderer/types/DashPayUsernames'
import { stripDpnsInput } from '@renderer/utils/dpnsLabel'

export default function UsernameField({ value, onChange, invalid }: UsernameFieldProps): React.JSX.Element {
  return (
    <div className={`flex items-center gap-2 dash-block rounded-2xl px-5 py-3.5 border ${invalid ? 'border-dash-red' : 'border-transparent focus-within:border-dash-brand dark:focus-within:border-dash-mint'}`}>
      <input
        type={"text"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onPaste={(event) => {
          event.preventDefault()
          onChange(stripDpnsInput(event.clipboardData.getData('text')))
        }}
        onBlur={() => onChange(stripDpnsInput(value))}
        aria-label={REGISTER_USERNAME_COPY.username}
        aria-invalid={invalid}
        placeholder={REGISTER_USERNAME_COPY.placeholder}
        maxLength={DPNS_LABEL_MAX}
        spellCheck={false}
        autoComplete={"off"}
        autoFocus
        className={"bg-transparent outline-none flex-1 min-w-0 text-2xl font-medium text-dash-primary-dark-blue dark:text-white placeholder:text-dash-primary-dark-blue/25 dark:placeholder:text-white/25"}
      />
      <Text size={24} weight={"medium"} color={"brand"} opacity={40} className={"shrink-0 select-none"}>{DPNS_NAME_SUFFIX}</Text>
    </div>
  )
}
