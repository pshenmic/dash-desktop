import { Input, Text } from '@renderer/components/dash-ui-kit-enxtended'
import CopyableError from '@renderer/components/ui/CopyableError'
import { WALLET_PASSWORD_LABEL, WALLET_PASSWORD_PLACEHOLDER } from '@renderer/constants/password'
import type { PasswordFieldProps } from '@renderer/types/PasswordField'

export default function PasswordField({
  id,
  value,
  onChange,
  onSubmit,
  error = null,
  label = WALLET_PASSWORD_LABEL,
  disabled = false,
  autoFocus = true,
  className = '',
}: PasswordFieldProps): React.JSX.Element {
  return (
    <div className={`flex flex-col ${className}`}>
      <label htmlFor={id} className={"mb-2"}>
        <Text size={14} weight={"medium"} color={"brand"} opacity={50}>{label}</Text>
      </label>
      <Input
        id={id}
        type={"password"}
        placeholder={WALLET_PASSWORD_PLACEHOLDER}
        value={value}
        variant={"outlined"}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onSubmit() }}
        className={"h-14.25 rounded-[1.25rem] bg-transparent!"}
        colorScheme={error ? 'error' : 'primary'}
        aria-invalid={error ? true : undefined}
        disabled={disabled}
        autoFocus={autoFocus}
      />
      <div className={`overflow-hidden transition-all duration-200 ${error ? 'max-h-40 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
        <CopyableError message={error ?? ''} />
      </div>
    </div>
  )
}
