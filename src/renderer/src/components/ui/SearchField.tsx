import { Input, SearchIcon } from '@renderer/components/dash-ui-kit-extended'
import type { SearchFieldProps } from '@renderer/types/SearchField'

export default function SearchField({
  value,
  onChange,
  placeholder,
  ariaLabel,
  autoFocus = false,
  className = '',
  inputClassName = 'h-9 py-0! rounded-[.625rem]! dash-block',
  onKeyDown,
  ref,
}: SearchFieldProps): React.JSX.Element {
  return (
    <div className={className}>
      <Input
        ref={ref}
        type={'search'}
        size={'sm'}
        variant={'filled'}
        colorScheme={'light'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        className={inputClassName}
        prefix={<SearchIcon size={14} color={'currentColor'} className={'dash-text-default'} />}
      />
    </div>
  )
}
