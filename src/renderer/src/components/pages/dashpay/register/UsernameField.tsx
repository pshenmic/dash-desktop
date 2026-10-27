import { Text } from '@renderer/components/dash-ui-kit-extended'
import { FIELD_INVALID } from '@renderer/constants/addressField'
import { REGISTER_USERNAME_COPY, USERNAME_FIELD_CLASS, USERNAME_INPUT_CLASS } from '@renderer/constants/dashPayUsernames'
import { DPNS_LABEL_MAX, DPNS_NAME_SUFFIX } from '@renderer/constants/dpns'
import type { UsernameFieldProps } from '@renderer/types/DashPayUsernames'
import { stripDpnsInput } from '@renderer/utils/dpnsLabel'

export default function UsernameField({ value, onChange, invalid }: UsernameFieldProps): React.JSX.Element {
  return (
    <div className={`${USERNAME_FIELD_CLASS} ${invalid ? FIELD_INVALID : ''}`}>
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
        className={USERNAME_INPUT_CLASS}
      />
      <Text size={24} weight={"medium"} color={"brand"} opacity={40} className={"shrink-0 select-none"}>{DPNS_NAME_SUFFIX}</Text>
    </div>
  )
}
